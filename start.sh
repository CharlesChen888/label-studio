export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
source .venv/bin/activate
cd web
bun run build
cd ..
python label_studio/manage.py makemigrations
python label_studio/manage.py migrate
python label_studio/manage.py collectstatic