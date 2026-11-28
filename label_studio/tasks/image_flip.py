import base64
import os
from copy import deepcopy
from io import BytesIO
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import requests
from data_import.models import FileUpload
from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image, ImageOps
from rest_framework.exceptions import ValidationError
from tasks.models import Task

FLIP_DIRECTIONS = {
    'horizontal': Image.Transpose.FLIP_LEFT_RIGHT,
    'vertical': Image.Transpose.FLIP_TOP_BOTTOM,
}


def _download_url(url, project):
    response = requests.get(
        url,
        auth=(project.task_data_login, project.task_data_password) if project.task_data_login else None,
        stream=True,
        timeout=30,
    )
    response.raise_for_status()

    content_length = response.headers.get('content-length')
    if content_length and int(content_length) > settings.TASKS_MAX_FILE_SIZE:
        raise ValidationError('The image exceeds the maximum task file size.')

    chunks = []
    total = 0
    for chunk in response.iter_content(chunk_size=64 * 1024):
        if not chunk:
            continue
        total += len(chunk)
        if total > settings.TASKS_MAX_FILE_SIZE:
            raise ValidationError('The image exceeds the maximum task file size.')
        chunks.append(chunk)
    return b''.join(chunks)


def _read_storage_bytes(task, value):
    from io_storages.functions import get_storage_by_url

    storage = get_storage_by_url(value, task.project.get_all_import_storage_objects)
    if storage is None:
        return None

    stream, _, metadata = storage.get_bytes_stream(value)
    if stream is None:
        raise ValidationError('Unable to download the selected image from connected storage.')

    content_length = metadata.get('ContentLength')
    if content_length is not None and int(content_length) > settings.TASKS_MAX_FILE_SIZE:
        raise ValidationError('The image exceeds the maximum task file size.')

    chunks = []
    total = 0
    try:
        while True:
            chunk = stream.read(64 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > settings.TASKS_MAX_FILE_SIZE:
                raise ValidationError('The image exceeds the maximum task file size.')
            chunks.append(chunk)
    finally:
        close = getattr(stream, 'close', None)
        if close is not None:
            close()

    return b''.join(chunks)


def _read_image_bytes(task, value):
    if not isinstance(value, str) or not value:
        raise ValidationError('The selected image field does not contain a valid image URL.')

    storage_bytes = _read_storage_bytes(task, value)
    if storage_bytes is not None:
        return storage_bytes

    parsed = urlparse(value)
    filepath = parse_qs(parsed.query).get('filepath', [parsed.path])[0]
    prepared = task.prepare_filename(unquote(filepath)).lstrip('/')
    upload = FileUpload.objects.filter(project=task.project, file=prepared).first()
    linked_upload = task.file_upload
    if upload is None and linked_upload is not None and prepared in {
        linked_upload.file.name,
        linked_upload.file.name.lstrip('/'),
    }:
        upload = linked_upload
    if upload is not None:
        upload.file.open('rb')
        try:
            return upload.file.read()
        finally:
            upload.file.close()

    resolved = task.resolve_uris({'image': value}, task.project).get('image')
    if not isinstance(resolved, str):
        raise ValidationError('The selected image could not be resolved.')
    if resolved.startswith('/'):
        resolved = urljoin(settings.HOSTNAME or f'http://localhost:{settings.INTERNAL_PORT}', resolved)

    try:
        return _download_url(resolved, task.project)
    except requests.RequestException as exc:
        raise ValidationError(f'Unable to download the selected image: {exc}') from exc


def _find_image_paths(data, field_name, path=()):
    matches = []
    if isinstance(data, dict):
        for key, value in data.items():
            current_path = (*path, key)
            if key == field_name:
                matches.append(current_path)
            matches.extend(_find_image_paths(value, field_name, current_path))
    elif isinstance(data, list):
        for index, value in enumerate(data):
            matches.extend(_find_image_paths(value, field_name, (*path, index)))
    return matches


def _get_path(data, path):
    value = data
    for part in path:
        value = value[part]
    return value


def _set_path(data, path, value):
    parent = data
    for part in path[:-1]:
        parent = parent[part]
    parent[path[-1]] = value


def _source_uri(source_url):
    if not isinstance(source_url, str):
        return None
    encoded_uri = parse_qs(urlparse(source_url).query).get('fileuri', [None])[0]
    if encoded_uri:
        try:
            return base64.urlsafe_b64decode(encoded_uri + '=' * (-len(encoded_uri) % 4)).decode()
        except (UnicodeDecodeError, ValueError):
            return None
    return source_url


def _leaf_paths(data, path=()):
    if isinstance(data, dict):
        for key, value in data.items():
            yield from _leaf_paths(value, (*path, key))
    elif isinstance(data, list):
        for index, value in enumerate(data):
            yield from _leaf_paths(value, (*path, index))
    elif isinstance(data, str):
        yield path, data


def _replace_image_value(data, data_field, item_index, new_value, source_url=None):
    direct_path = tuple(part for part in data_field.split('.') if part)
    try:
        _get_path(data, direct_path)
        path = direct_path
    except (KeyError, IndexError, TypeError):
        matches = _find_image_paths(data, direct_path[-1] if direct_path else data_field)
        if len(matches) != 1:
            source_uri = _source_uri(source_url)
            matches = [
                leaf_path
                for leaf_path, value in _leaf_paths(data)
                if source_uri and value in {source_uri, unquote(source_url)}
            ]
        if len(matches) != 1:
            raise ValidationError(f'Task data field "{data_field}" does not exist or is ambiguous.')
        path = matches[0]

    value = _get_path(data, path)
    if isinstance(value, list):
        if item_index is None or not isinstance(item_index, int) or not 0 <= item_index < len(value):
            raise ValidationError('A valid item_index is required for a multi-image task.')
        selected = value[item_index]
        updated = list(value)
        updated[item_index] = new_value
        _set_path(data, path, updated)
        return selected, updated

    if item_index not in (None, 0):
        raise ValidationError('item_index is only valid for a multi-image task.')
    _set_path(data, path, new_value)
    return value, new_value


def _flip_image(source, direction):
    try:
        with Image.open(BytesIO(source)) as image:
            image.load()
            normalized = ImageOps.exif_transpose(image)
            flipped = normalized.transpose(FLIP_DIRECTIONS[direction])
            image_format = image.format or 'PNG'
            output = BytesIO()
            flipped.save(output, format=image_format)
    except (OSError, ValueError) as exc:
        raise ValidationError(f'The selected file is not a supported image: {exc}') from exc

    return output.getvalue(), image_format


def _original_image_extension(value, image_format):
    parsed = urlparse(value)
    source_path = parse_qs(parsed.query).get('filepath', [parsed.path])[0]
    extension = os.path.splitext(unquote(source_path))[1]
    if extension:
        return extension.lower()

    return next(
        (suffix for suffix, registered_format in Image.registered_extensions().items() if registered_format == image_format),
        '.png',
    ).lower()


def flip_task_image(task, user, direction, data_field, source_url=None, item_index=None):
    if direction not in FLIP_DIRECTIONS:
        raise ValidationError('direction must be "horizontal" or "vertical".')
    if not isinstance(data_field, str) or not data_field:
        raise ValidationError('data_field is required.')

    original_data = deepcopy(task.data)
    selected, _ = _replace_image_value(deepcopy(original_data), data_field, item_index, None, source_url)
    source = _read_image_bytes(task, selected)
    content, image_format = _flip_image(source, direction)
    extension = _original_image_extension(selected, image_format)

    parsed_selected = urlparse(selected)
    source_path = parse_qs(parsed_selected.query).get('filepath', [parsed_selected.path])[0]
    stem = os.path.splitext(os.path.basename(unquote(source_path)))[0] or f'task-{task.id}'
    filename = f'{stem}-{direction}-flip{extension}'
    upload = FileUpload.objects.create(user=user, project=task.project, file=ContentFile(content, name=filename))
    download_url = urljoin(settings.HOSTNAME or f'http://localhost:{settings.INTERNAL_PORT}', upload.url)

    _, updated_value = _replace_image_value(original_data, data_field, item_index, upload.url, source_url)
    new_data = deepcopy(original_data)
    new_data[data_field] = updated_value
    meta = deepcopy(task.meta) if isinstance(task.meta, dict) else {}
    meta['image_flip'] = {
        'direction': direction,
        'source_task_id': task.id,
        'data_field': data_field,
        'item_index': item_index,
        'download_url': download_url,
    }
    new_task = Task.objects.create(
        project=task.project,
        data=new_data,
        meta=meta,
        file_upload=upload,
        overlap=task.overlap,
        allow_skip=task.allow_skip,
    )
    return new_task, upload, download_url
