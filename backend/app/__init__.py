"""Nanyang backend package.

The package initializer attaches dashboard modules that live directly in the
Nanyang repository.  Existing VVIC and Easy Lean routes continue to be loaded
by app.main exactly as before.
"""


def _register_model_line_router() -> None:
    # app.main is the uvicorn entry point. Importing it here during package
    # initialization is safe: Python caches the module, so uvicorn receives the
    # same FastAPI instance after this registration completes.
    from . import main as main_module
    from .model_line import build_model_line_router

    main_module.app.include_router(build_model_line_router(main_module.get_db))


_register_model_line_router()
