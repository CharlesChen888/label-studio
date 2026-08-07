from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('tasks', '0062_task_data_trgm_idx_async'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='last_submitted_comment',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Last comment submitted from the task labeling page',
                verbose_name='last submitted comment',
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='last_submitted_comment_at',
            field=models.DateTimeField(
                db_index=True,
                default=None,
                help_text='When the last task-level comment was submitted',
                null=True,
                verbose_name='last submitted comment at',
            ),
        ),
    ]
