/* istanbul ignore file */
import { MediaManager } from "@/features/media/components/MediaManager";

export default function MediaAdminPage(): JSX.Element {
  return (
    <main style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <header>
        <h1>Media Management</h1>
        <p>Upload, curate, and organize Cloudinary assets.</p>
      </header>
      <MediaManager />
    </main>
  );
}
