import sys
import traceback

try:
    from backend.routes import company
    print("Import successful")
except Exception:
    with open("import_error.log", "w") as f:
        traceback.print_exc(file=f)
    print("Import failed")
    sys.exit(1)
