import json

import pytest
from projects import models as project_models
from projects.models import ProjectSummary
from tasks.models import Task
from tests.conftest import project_choices
from tests.utils import make_project

pytestmark = pytest.mark.django_db


def test_get_labels_extracts_bare_array_for_labels_pass_through():
    summary = ProjectSummary()
    result = {
        'type': 'labels',
        'from_name': 'selected_images',
        'value': ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    }
    assert summary._get_labels(result) == [
        'https://example.com/a.jpg',
        'https://example.com/b.jpg',
    ]


def test_get_labels_ignores_bare_array_for_non_labels_types():
    summary = ProjectSummary()
    result = {
        'type': 'choices',
        'from_name': 'sentiment',
        'value': ['positive'],
    }
    assert summary._get_labels(result) == []


def test_reset_summary_empty_project(business_client):
    project = make_project(project_choices(), business_client.user, use_ml_backend=False)
    s = project.summary

    for field in ['created_labels', 'created_labels_drafts', 'created_annotations']:
        setattr(s, field, {'garbled': field})
    s.save()

    r = business_client.post(f'/api/projects/{project.id}/summary/reset')
    assert r.status_code == 200

    s.refresh_from_db()
    for field in ['created_labels', 'created_labels_drafts', 'created_annotations']:
        assert getattr(s, field) == {}


def test_reset_summary_project_has_drafts(business_client):
    project = make_project(project_choices(), business_client.user, use_ml_backend=False)

    r = business_client.post(
        f'/api/projects/{project.id}/import',
        data=json.dumps({'data': {'image': 'kittens.jpg'}}),
        content_type='application/json',
    )
    assert r.status_code == 201
    task = Task.objects.filter(project=project).first()
    assert task

    s = project.summary
    r = business_client.post(
        f'/api/tasks/{task.id}/drafts',
        data=json.dumps(
            {'result': [{'from_name': 'some', 'to_name': 'x', 'type': 'none', 'value': {'none': ['Opossum']}}]}
        ),
        content_type='application/json',
    )
    assert r.status_code == 201

    for field in ['created_labels', 'created_labels_drafts', 'created_annotations']:
        setattr(s, field, {'garbled': field})
    s.save()

    r = business_client.post(f'/api/projects/{project.id}/summary/reset')
    assert r.status_code == 200

    s.refresh_from_db()
    for field in ['created_labels', 'created_annotations']:
        assert getattr(s, field) == {}

    assert s.created_labels_drafts == {'some': {'Opossum': 1}}


def test_reset_summary_project_has_annotations(business_client):
    project = make_project(project_choices(), business_client.user, use_ml_backend=False)

    r = business_client.post(
        f'/api/projects/{project.id}/import',
        data=json.dumps({'data': {'image': 'kittens.jpg'}}),
        content_type='application/json',
    )
    assert r.status_code == 201
    task = Task.objects.filter(project=project).first()
    assert task

    s = project.summary
    r = business_client.post(
        f'/api/tasks/{task.id}/annotations',
        data=json.dumps(
            {'result': [{'from_name': 'some', 'to_name': 'x', 'type': 'none', 'value': {'none': ['Opossum']}}]}
        ),
        content_type='application/json',
    )
    assert r.status_code == 201

    for field in ['created_labels', 'created_labels_drafts', 'created_annotations']:
        setattr(s, field, {'garbled': field})
    s.save()

    r = business_client.post(f'/api/projects/{project.id}/summary/reset')
    assert r.status_code == 200

    s.refresh_from_db()
    assert s.created_labels_drafts == {}
    assert s.created_annotations == {'some|x|none': 1}
    assert s.created_labels == {'some': {'Opossum': 1}}


def test_imported_annotations_update_project_summary_without_reset(business_client):
    project = make_project(project_choices(), business_client.user, use_ml_backend=False)

    response = business_client.post(
        f'/api/projects/{project.id}/import',
        data=json.dumps(
            [
                {
                    'data': {'image': 'kittens.jpg'},
                    'annotations': [
                        {
                            'result': [
                                {
                                    'from_name': 'animals',
                                    'to_name': 'xxx',
                                    'type': 'choices',
                                    'value': {'choices': ['Cat']},
                                }
                            ]
                        }
                    ],
                }
            ]
        ),
        content_type='application/json',
    )
    assert response.status_code == 201

    project.summary.refresh_from_db()
    assert project.summary.created_annotations == {'animals|xxx|choices': 1}
    assert project.summary.created_labels == {'animals': {'Cat': 1}}


def test_delete_tasks_and_annotations_clears_created_drafts_annotations_and_labels(business_client):
    project = make_project(project_choices(), business_client.user, use_ml_backend=False)

    r = business_client.post(
        f'/api/projects/{project.id}/import',
        data=json.dumps({'data': {'image': 'kittens.jpg'}}),
        content_type='application/json',
    )
    assert r.status_code == 201
    task = Task.objects.filter(project=project).first()
    assert task

    s = project.summary

    r = business_client.post(
        f'/api/tasks/{task.id}/drafts',
        data=json.dumps(
            {'result': [{'from_name': 'some', 'to_name': 'x', 'type': 'none', 'value': {'none': ['Mouse']}}]}
        ),
        content_type='application/json',
    )
    assert r.status_code == 201
    r = business_client.post(
        f'/api/tasks/{task.id}/annotations',
        data=json.dumps(
            {'result': [{'from_name': 'some', 'to_name': 'x', 'type': 'none', 'value': {'none': ['Opossum']}}]}
        ),
        content_type='application/json',
    )
    assert r.status_code == 201

    for field in ['created_labels', 'created_labels_drafts', 'created_annotations']:
        setattr(s, field, {'garbled': field})
    s.save()

    r = business_client.post(f'/api/dm/actions?id=delete_tasks_annotations&project={project.id}')
    assert r.status_code == 200

    s.refresh_from_db()
    for field in ['created_labels', 'created_labels_drafts', 'created_annotations']:
        assert getattr(s, field) == {}


def test_sqlite_skips_atomic_draft_summary_update(monkeypatch, business_client):
    project = make_project(project_choices(), business_client.user, use_ml_backend=False)
    summary = project.summary

    monkeypatch.setattr(project_models, 'flag_set', lambda *args, **kwargs: True)
    monkeypatch.setattr(project_models, '_supports_atomic_jsonb_summary_updates', lambda: False)

    called = False

    def fail_if_called(*args, **kwargs):
        nonlocal called
        called = True
        raise AssertionError('atomic jsonb update should be skipped on sqlite')

    monkeypatch.setattr(summary, '_atomic_update_created_labels_drafts', fail_if_called)

    summary.update_created_labels_drafts(
        [
            {
                'result': [
                    {
                        'from_name': 'some',
                        'to_name': 'x',
                        'type': 'choices',
                        'value': {'choices': ['Opossum']},
                    }
                ]
            }
        ]
    )

    summary.refresh_from_db()
    assert called is False
    assert summary.created_labels_drafts == {'some': {'Opossum': 1}}


def test_sqlite_skips_atomic_annotation_summary_update(monkeypatch, business_client):
    project = make_project(project_choices(), business_client.user, use_ml_backend=False)
    summary = project.summary

    monkeypatch.setattr(project_models, 'flag_set', lambda *args, **kwargs: True)
    monkeypatch.setattr(project_models, '_supports_atomic_jsonb_summary_updates', lambda: False)

    called = False

    def fail_if_called(*args, **kwargs):
        nonlocal called
        called = True
        raise AssertionError('atomic jsonb update should be skipped on sqlite')

    monkeypatch.setattr(summary, '_atomic_update_created_annotations_and_labels', fail_if_called)

    summary.update_created_annotations_and_labels(
        [
            {
                'result': [
                    {
                        'from_name': 'some',
                        'to_name': 'x',
                        'type': 'choices',
                        'value': {'choices': ['Opossum']},
                    }
                ]
            }
        ]
    )

    summary.refresh_from_db()
    assert called is False
    assert summary.created_annotations == {'some|x|choices': 1}
    assert summary.created_labels == {'some': {'Opossum': 1}}


def test_logged_out_user_cannot_reset_summary(business_client):
    project = make_project(project_choices(), business_client.user, use_ml_backend=False)
    r = business_client.get('/logout')
    assert r.status_code == 302
    r = business_client.post(f'/api/projects/{project.id}/summary/reset')
    assert r.status_code == 401
    assert 'detail' in (r_json := r.json())
    assert r_json['detail'] == 'Authentication credentials were not provided.'
