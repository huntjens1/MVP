import { useAuth } from "./AuthContext";
export default function LogoutButton() {
  const { logout } = useAuth();
  return <button onClick={logout}>Uitloggen</button>;
}
