"""
Django settings for config project.
"""

import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent.parent
if load_dotenv:
    load_dotenv(BASE_DIR / ".env")

DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() in ("1", "true", "yes")

_DEV_SECRET_KEY = "django-insecure-dev-only-change-in-production"
SECRET_KEY = (
    os.environ.get("SECRET_KEY")
    or os.environ.get("DJANGO_SECRET_KEY")
    or _DEV_SECRET_KEY
)

_allowed_hosts_raw = os.environ.get("ALLOWED_HOSTS") or os.environ.get(
    "DJANGO_ALLOWED_HOSTS",
    "localhost,127.0.0.1",
)
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_raw.split(",") if h.strip()]

# Tenant storefront subdomains (e.g. mmch.mmiraq.com) — leading dot matches all subdomains.
_extra_allowed_hosts = os.environ.get(
    "DJANGO_EXTRA_ALLOWED_HOSTS",
    ".mmiraq.com,dashboard.mmiraq.com",
)
for _host in _extra_allowed_hosts.split(","):
    _host = _host.strip()
    if _host and _host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_host)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "shops",
    "accounts",
    "inventory",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

USE_SQLITE = os.environ.get("DJANGO_USE_SQLITE", "false").lower() in ("1", "true", "yes")

_database_url = os.environ.get("DATABASE_URL", "").strip()
if _database_url:
    DATABASES = {
        "default": dj_database_url.config(
            default=_database_url,
            conn_max_age=int(os.environ.get("DATABASE_CONN_MAX_AGE", "600")),
        )
    }
elif USE_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "pos_system"),
            "USER": os.environ.get("POSTGRES_USER", "postgres"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "postgres"),
            "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "EXCEPTION_HANDLER": "config.exceptions.custom_exception_handler",
}

_default_local_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]


def _split_origins(value: str) -> list[str]:
    return [o.strip() for o in value.split(",") if o.strip()]


_cors_env = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
_extra_frontend = os.environ.get("DJANGO_DEV_FRONTEND_ORIGINS", "").strip()
if _cors_env:
    CORS_ALLOWED_ORIGINS = _split_origins(_cors_env)
elif DEBUG:
    CORS_ALLOWED_ORIGINS = [
        *_default_local_origins,
        *_split_origins(_extra_frontend),
    ]
else:
    CORS_ALLOWED_ORIGINS = []

# Public storefront on tenant subdomains (https://mmch.mmiraq.com → API on dashboard).
CORS_ALLOW_ALL_ORIGINS = os.environ.get("CORS_ALLOW_ALL_ORIGINS", "").lower() in (
    "1",
    "true",
    "yes",
)

_DEFAULT_MMIRAq_CORS_REGEXES = [
    r"^https://[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.mmiraq\.com$",
    r"^https://mmiraq\.com$",
    r"^https://www\.mmiraq\.com$",
    r"^https://dashboard\.mmiraq\.com$",
]
_cors_regex_env = os.environ.get("CORS_ALLOWED_ORIGIN_REGEXES", "").strip()
if CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGIN_REGEXES: list[str] = []
elif _cors_regex_env:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r.strip() for r in _cors_regex_env.split(",") if r.strip()
    ]
elif not _cors_env and not DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = _DEFAULT_MMIRAq_CORS_REGEXES
else:
    CORS_ALLOWED_ORIGIN_REGEXES = []

_csrf_env = os.environ.get("CSRF_TRUSTED_ORIGINS", "").strip()
if _csrf_env:
    CSRF_TRUSTED_ORIGINS = _split_origins(_csrf_env)
elif DEBUG:
    CSRF_TRUSTED_ORIGINS = [
        *_default_local_origins,
        *_split_origins(_extra_frontend),
    ]
else:
    CSRF_TRUSTED_ORIGINS = [
        "https://*.mmiraq.com",
        "https://dashboard.mmiraq.com",
    ]

# Browsers reject credentials + Access-Control-Allow-Origin: * together.
CORS_ALLOW_CREDENTIALS = not CORS_ALLOW_ALL_ORIGINS

if os.environ.get("DJANGO_BEHIND_PROXY", "").lower() in ("1", "true", "yes"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

if not DEBUG:
    if not SECRET_KEY or SECRET_KEY == _DEV_SECRET_KEY:
        raise ImproperlyConfigured(
            "Set SECRET_KEY or DJANGO_SECRET_KEY to a strong random value when DJANGO_DEBUG is false."
        )
    if "SECRET_KEY" not in os.environ and "DJANGO_SECRET_KEY" not in os.environ:
        raise ImproperlyConfigured(
            "Production requires SECRET_KEY or DJANGO_SECRET_KEY to be present in the environment."
        )
    if "ALLOWED_HOSTS" not in os.environ and "DJANGO_ALLOWED_HOSTS" not in os.environ:
        raise ImproperlyConfigured(
            "Production requires ALLOWED_HOSTS or DJANGO_ALLOWED_HOSTS in the environment "
            "(comma-separated hostnames, e.g. api.example.com)."
        )
    if not USE_SQLITE:
        if not os.environ.get("DATABASE_URL", "").strip():
            raise ImproperlyConfigured(
                "Production PostgreSQL deployments require DATABASE_URL in the environment "
                "(e.g. postgresql://USER:PASSWORD@HOST:5432/DBNAME)."
            )
        engine = DATABASES["default"].get("ENGINE", "")
        if "postgresql" not in engine:
            raise ImproperlyConfigured(
                "DATABASE_URL must resolve to a PostgreSQL backend for this project."
            )
    _has_cors = (
        bool(os.environ.get("CORS_ALLOWED_ORIGINS", "").strip())
        or CORS_ALLOW_ALL_ORIGINS
        or bool(CORS_ALLOWED_ORIGIN_REGEXES)
    )
    if not _has_cors:
        raise ImproperlyConfigured(
            "Production requires CORS: set CORS_ALLOWED_ORIGINS, CORS_ALLOW_ALL_ORIGINS=1, "
            "or rely on default CORS_ALLOWED_ORIGIN_REGEXES for *.mmiraq.com."
        )
    if not os.environ.get("CSRF_TRUSTED_ORIGINS", "").strip() and not CSRF_TRUSTED_ORIGINS:
        raise ImproperlyConfigured(
            "Production requires CSRF_TRUSTED_ORIGINS (comma-separated origins matching "
            "your frontend, e.g. https://app.example.com)."
        )
