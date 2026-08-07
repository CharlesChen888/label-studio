from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('projects', '0035_projectsummary_dimension_value_counts'),
        ('tasks', '0063_task_last_submitted_comment'),
    ]

    operations = [
        migrations.CreateModel(
            name='Comment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField(blank=True, default='', help_text='Comment text', verbose_name='text')),
                (
                    'region_ref',
                    models.JSONField(blank=True, default=None, help_text='Linked region metadata', null=True, verbose_name='region ref'),
                ),
                (
                    'classifications',
                    models.JSONField(
                        blank=True,
                        default=None,
                        help_text='Optional structured classifications attached to the comment',
                        null=True,
                        verbose_name='classifications',
                    ),
                ),
                (
                    'is_resolved',
                    models.BooleanField(default=False, help_text='Whether the comment is resolved', verbose_name='is resolved'),
                ),
                (
                    'resolved_at',
                    models.DateTimeField(
                        blank=True,
                        default=None,
                        help_text='When the comment was marked as resolved',
                        null=True,
                        verbose_name='resolved at',
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True, help_text='Creation time', verbose_name='created at')),
                ('updated_at', models.DateTimeField(auto_now=True, help_text='Last updated time', verbose_name='updated at')),
                (
                    'annotation',
                    models.ForeignKey(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name='comments', to='tasks.annotation'),
                ),
                (
                    'created_by',
                    models.ForeignKey(
                        blank=True,
                        help_text='User who created this comment',
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name='comments',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'draft',
                    models.ForeignKey(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name='comments', to='tasks.annotationdraft'),
                ),
                ('project', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='comments', to='projects.project')),
                ('task', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='comments', to='tasks.task')),
                (
                    'updated_by',
                    models.ForeignKey(
                        blank=True,
                        help_text='Last user who updated this comment',
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name='updated_comments',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'db_table': 'comment',
            },
        ),
        migrations.AddIndex(
            model_name='comment',
            index=models.Index(fields=['task', 'id'], name='comment_task_id_8452af_idx'),
        ),
        migrations.AddIndex(
            model_name='comment',
            index=models.Index(fields=['annotation', 'id'], name='comment_annotat_250aaf_idx'),
        ),
        migrations.AddIndex(
            model_name='comment',
            index=models.Index(fields=['draft', 'id'], name='comment_draft_i_0d8a55_idx'),
        ),
        migrations.AddIndex(
            model_name='comment',
            index=models.Index(fields=['project', 'id'], name='comment_project_b6d73a_idx'),
        ),
        migrations.AddIndex(
            model_name='comment',
            index=models.Index(fields=['task', 'is_resolved'], name='comment_task_is_5d9605_idx'),
        ),
    ]
