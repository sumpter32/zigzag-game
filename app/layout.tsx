import './globals.css'
export const metadata = { title: 'Zigzag 🔀', description: 'Tap to zigzag!' }
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
