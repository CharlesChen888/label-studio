# Generated migration for adding role field to OrganizationMember

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0006_alter_organizationmember_deleted_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='organizationmember',
            name='role',
            field=models.CharField(
                choices=[
                    ('owner', 'Owner'),
                    ('annotator', 'Annotator'),
                    ('reviewer', 'Reviewer'),
                ],
                default='annotator',
                help_text='User role in the organization',
                max_length=20,
                verbose_name='role',
            ),
        ),
    ]
