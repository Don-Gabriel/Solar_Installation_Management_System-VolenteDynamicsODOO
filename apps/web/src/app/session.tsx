import { createContext, useContext } from "react";
import type { User } from "../../../../packages/contracts/src/index";
export const SessionContext = createContext<{ user: User }>({
  user: null as unknown as User,
});
export const useSession = () => useContext(SessionContext);
export function Can({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { user } = useSession();
  return roles.includes(user.role) ? children : null;
}
