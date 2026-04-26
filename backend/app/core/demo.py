from fastapi import HTTPException


def demo_mode_forbidden(action: str) -> HTTPException:
    return HTTPException(status_code=403, detail=f"{action} is disabled while demo mode is enabled")