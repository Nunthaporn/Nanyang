"""Nanyang backend package.

Attach dashboard modules that live directly in the Nanyang repository while
preserving the existing VVIC/Easy Lean application entry point.
"""


def _register_router(builder) -> None:
    from starlette.routing import Mount

    from . import main as main_module

    app = main_module.app
    before = list(app.router.routes)
    before_ids = {id(route) for route in before}

    app.include_router(builder(main_module.get_db))

    # app.main may mount the production frontend at '/'. A root Mount matches
    # every path, so routes added after it must be moved in front of that mount.
    all_routes = list(app.router.routes)
    new_routes = [route for route in all_routes if id(route) not in before_ids]
    existing_routes = [route for route in all_routes if id(route) in before_ids]

    root_mount_index = next(
        (
            i
            for i, route in enumerate(existing_routes)
            if isinstance(route, Mount)
            and getattr(route, "path", None) in ("", "/")
        ),
        len(existing_routes),
    )

    app.router.routes = (
        existing_routes[:root_mount_index]
        + new_routes
        + existing_routes[root_mount_index:]
    )


def _register_nanyang_dashboards() -> None:
    from .model_line import build_model_line_router
    from .min_vs_eff import build_min_vs_eff_router

    _register_router(build_model_line_router)
    _register_router(build_min_vs_eff_router)


_register_nanyang_dashboards()
