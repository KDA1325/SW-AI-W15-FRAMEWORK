import os
from pathlib import Path


_ENV_LOADED = False


def load_local_env() -> None:
    """Load local development env files without overriding real environment variables."""
    global _ENV_LOADED

    if _ENV_LOADED:
        return

    app_dir = Path(__file__).resolve().parent
    ai_compute_dir = app_dir.parent
    repo_dir = ai_compute_dir.parent
    candidates = [
        ai_compute_dir / ".env",
        repo_dir / ".env",
        repo_dir / "server" / ".env",
    ]

    for path in candidates:
        if path.exists():
            load_env_file(path)

    _ENV_LOADED = True


def load_env_file(path: Path) -> None:
    try:
        text = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = path.read_text(encoding="cp949")
        except (OSError, UnicodeDecodeError):
            return
    except OSError:
        return

    lines = text.splitlines()

    for raw_line in lines:
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if not key or key in os.environ:
            continue

        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]

        os.environ[key] = value
