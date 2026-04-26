from pydantic import BaseModel


class AppConfigResponse(BaseModel):
    app_name: str
    app_version: str
    debug: bool
    demo_mode: bool
