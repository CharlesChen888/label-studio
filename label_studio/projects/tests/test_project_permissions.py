import pytest

from organizations.models import Organization
from projects.models import ProjectMember
from projects.tests.factories import ProjectFactory
from rest_framework.test import APIClient
from users.models import User
from users.tests.factories import UserFactory


def create_superuser(email='superuser@example.com'):
    user = User.objects.create_user(email=email, password='S3cure-passw0rd!', is_superuser=True, is_staff=True)
    organization = Organization.create_organization(created_by=user, title='Main Organization')
    user.active_organization = organization
    user.save(update_fields=['active_organization'])
    return user, organization


def add_user_to_organization(organization, user):
    organization.add_user(user)
    user.active_organization = organization
    user.save(update_fields=['active_organization'])


@pytest.mark.django_db
def test_project_visibility_is_limited_to_superuser_creator_and_members():
    superuser, organization = create_superuser()
    member = UserFactory()
    stranger = UserFactory()

    add_user_to_organization(organization, member)
    add_user_to_organization(organization, stranger)

    project = ProjectFactory(organization=organization, created_by=superuser)
    project.add_collaborator(member)

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    response = member_client.get('/api/projects/')
    assert response.status_code == 200
    assert [item['id'] for item in response.json()['results']] == [project.id]
    assert member_client.get(f'/api/projects/{project.id}/').status_code == 200

    stranger_client = APIClient()
    stranger_client.force_authenticate(user=stranger)
    response = stranger_client.get('/api/projects/')
    assert response.status_code == 200
    assert response.json()['results'] == []
    assert stranger_client.get(f'/api/projects/{project.id}/').status_code == 404

    superuser_client = APIClient()
    superuser_client.force_authenticate(user=superuser)
    response = superuser_client.get('/api/projects/')
    assert response.status_code == 200
    assert [item['id'] for item in response.json()['results']] == [project.id]


@pytest.mark.django_db
def test_only_superuser_can_create_update_delete_projects_and_manage_members():
    superuser, organization = create_superuser()
    regular_user = UserFactory()
    candidate_member = UserFactory()

    add_user_to_organization(organization, regular_user)
    add_user_to_organization(organization, candidate_member)

    project = ProjectFactory(organization=organization, created_by=superuser)

    regular_client = APIClient()
    regular_client.force_authenticate(user=regular_user)

    create_response = regular_client.post(
        '/api/projects/',
        data={'title': 'Blocked Project', 'label_config': '<View></View>'},
        format='json',
    )
    assert create_response.status_code == 403

    patch_response = regular_client.patch(
        f'/api/projects/{project.id}/',
        data={'title': 'Blocked Rename'},
        format='json',
    )
    assert patch_response.status_code == 403

    delete_response = regular_client.delete(f'/api/projects/{project.id}/')
    assert delete_response.status_code == 403

    list_members_response = regular_client.get(f'/api/projects/{project.id}/memberships/')
    assert list_members_response.status_code == 403

    add_member_response = regular_client.post(
        f'/api/projects/{project.id}/memberships/',
        data={'user': candidate_member.id},
        format='json',
    )
    assert add_member_response.status_code == 403

    superuser_client = APIClient()
    superuser_client.force_authenticate(user=superuser)

    add_member_response = superuser_client.post(
        f'/api/projects/{project.id}/memberships/',
        data={'user': candidate_member.id},
        format='json',
    )
    assert add_member_response.status_code == 201
    assert ProjectMember.objects.filter(project=project, user=candidate_member, enabled=True).exists()

    remove_member_response = superuser_client.delete(f'/api/projects/{project.id}/memberships/{candidate_member.id}/')
    assert remove_member_response.status_code == 204
    assert not ProjectMember.objects.filter(project=project, user=candidate_member).exists()
