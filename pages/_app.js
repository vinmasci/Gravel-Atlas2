import { UserProvider } from '@auth0/nextjs-auth0';
import '../styles/globals.css';  // Add this line

export default function App({ Component, pageProps }) {
  return (
    <UserProvider>
      <Component {...pageProps} />
    </UserProvider>
  );
}