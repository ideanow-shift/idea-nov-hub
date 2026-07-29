from __future__ import annotations

from .domain import ActorContext, ActorRole, ActorScopeType


class AuthorizationError(PermissionError):
    pass


def require_trusted(actor: ActorContext) -> None:
    if not actor.trusted_server_context:
        raise AuthorizationError("actor context must be resolved server-side")


def require_role(actor: ActorContext, *roles: ActorRole) -> None:
    require_trusted(actor)
    if actor.role not in roles:
        raise AuthorizationError("actor role is not permitted")


def can_access(actor: ActorContext, scope_type: str, scope_id: str) -> bool:
    require_trusted(actor)
    if actor.role is ActorRole.EMPLOYEE or actor.scope_type is ActorScopeType.NONE:
        return False
    if actor.scope_type is ActorScopeType.ALL_GROUP:
        return actor.role in {
            ActorRole.ACCOUNTING_ADMIN,
            ActorRole.ACCOUNTING_REVIEWER,
            ActorRole.MANAGEMENT_APPROVER,
            ActorRole.EXECUTIVE_VIEWER,
        }
    return actor.scope_type.value == scope_type and scope_id in actor.scope_ids


def require_scope(actor: ActorContext, scope_type: str, scope_id: str) -> None:
    if not can_access(actor, scope_type, scope_id):
        raise AuthorizationError("requested accounting scope is not permitted")
