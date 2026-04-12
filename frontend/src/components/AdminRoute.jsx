import AccessDenied from '../pages/AccessDenied'

/**
 * AdminRoute — wraps any component that requires the 'admin' role.
 * Non-admin users see the 403 AccessDenied page instead of the
 * protected content. No redirect is performed so the URL stays
 * visible, making the protection unambiguous.
 */
export default function AdminRoute({ user, children }) {
  if (user?.role !== 'admin') {
    return <AccessDenied user={user} />
  }
  return children
}
