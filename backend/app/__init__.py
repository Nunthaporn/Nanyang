"""Nanyang backend package.

Attach dashboard modules that live directly in the Nanyang repository while
preserving the existing VVIC/Easy Lean application entry point.
"""


def _register_model_line_router() -> None:
    from starlette.routing import Mount

    from . import main as main_module
    from .model_line import build_model_line_router

    app = main_module.app
    before = list(app.router.routes)
    before_ids = {id(route) for route in before}

    app.include_router(build_model_line_router(main_module.get_db))

    # app.main mounts the built frontend at '/'. Because a root Mount matches
    # every path, API routes registered after it would never be reached in a
    # production build. Move the newly-added Model-Line routes immediately
    # before the root frontend mount.
    all_routes = list(app.router.routes)
    new_routes = [route for route in all_routes if id(route) not in before_ids]
    existing_routes = [route for route in all_routes if id(route) in before_ids]

    root_mount_index = next(
        (
            i
            for i, route in enumerate(existing_routes)
            if isinstance(route, Mount) and getattr(route, "path", None) == ""
        ),
        len(existing_routes),
    )

    app.router.routes = (
        existing_routes[:root_mount_index]
        + new_routes
        + existing_routes[root_mount_index:]
    )


_register_model_line_router()
