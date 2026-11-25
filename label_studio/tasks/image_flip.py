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


def _read_image_bytes(task, value):
    if not isinstance(value, str) or not value:
        raise ValidationError('The selected image field does not contain a valid image URL.')

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


def _replace_image_value(data, data_field, item_index, new_value):
    if data_field not in data:
        raise ValidationError(f'Task data field "{data_field}" does not exist.')

    value = data[data_field]
    if isinstance(value, list):
        if item_index is None or not isinstance(item_index, int) or not 0 <= item_index < len(value):
            raise ValidationError('A valid item_index is required for a multi-image task.')
        selected = value[item_index]
        updated = list(value)
        updated[item_index] = new_value
        return selected, updated

    if item_index not in (None, 0):
        raise ValidationError('item_index is only valid for a multi-image task.')
    return value, new_value


def _flip_image(source, direction):
    try:
        with Image.open(BytesIO(source)) as image:
            image.load()
            normalized = ImageOps.exif_transpose(image)
            flipped = normalized.transpose(FLIP_DIRECTIONS[direction])
            image_format = image.format or 'PNG'
            extension = next(
                (suffix for suffix, registered_format in Image.registered_extensions().items() if registered_format == image_format),
                '.png',
            )
            output = BytesIO()
            flipped.save(output, format=image_format)
    except (OSError, ValueError) as exc:
        raise ValidationError(f'The selected file is not a supported image: {exc}') from exc

    return output.getvalue(), extension.lower()


def flip_task_image(task, user, direction, data_field, item_index=None):
    if direction not in FLIP_DIRECTIONS:
        raise ValidationError('direction must be "horizontal" or "vertical".')
    if not isinstance(data_field, str) or not data_field:
        raise ValidationError('data_field is required.')

    original_data = deepcopy(task.data)
    selected, _ = _replace_image_value(original_data, data_field, item_index, None)
    source = _read_image_bytes(task, selected)
    content, extension = _flip_image(source, direction)

    stem = os.path.splitext(os.path.basename(unquote(urlparse(selected).path)))[0] or f'task-{task.id}'
    filename = f'{stem}-{direction}-flip{extension}'
    upload = FileUpload.objects.create(user=user, project=task.project, file=ContentFile(content, name=filename))
    download_url = urljoin(settings.HOSTNAME or f'http://localhost:{settings.INTERNAL_PORT}', upload.url)

    _, updated_value = _replace_image_value(original_data, data_field, item_index, upload.url)
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
