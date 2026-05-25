from django.apps import AppConfig


class ShopsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'shops'

    def ready(self) -> None:
        # Avoid scheduler during migrate/test shell.
        import sys

        skip = {"migrate", "makemigrations", "test", "shell", "collectstatic"}
        if any(cmd in sys.argv for cmd in skip):
            return
        try:
            from shops.manager_telegram_scheduler import start_manager_telegram_scheduler

            start_manager_telegram_scheduler()
        except Exception:
            import logging

            logging.getLogger(__name__).exception("Could not start manager Telegram scheduler")
