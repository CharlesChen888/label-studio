from rest_framework.permissions import SAFE_METHODS, BasePermission


def _get_view_permission_name(view, method):
    permission_required = getattr(view, 'permission_required', None)
    if permission_required is None:
        return None
    if isinstance(permission_required, str):
        return permission_required
    return getattr(permission_required, method, None)


class HasObjectPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        permission = _get_view_permission_name(view, request.method)
        try:
            return obj.has_permission(request.user, permission=permission, request_method=request.method)
        except TypeError:
            return obj.has_permission(request.user)


class MemberHasOwnerPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method not in SAFE_METHODS and not request.user.own_organization:
            return False

        permission = _get_view_permission_name(view, request.method)
        try:
            return obj.has_permission(request.user, permission=permission, request_method=request.method)
        except TypeError:
            return obj.has_permission(request.user)
