// Preview canvas page — now reads real data from the database.
// The fixture file (analysis.json) has been deleted; this route redirects to
// the /analysis/<id> route which owns the full map experience.
//
// Keeping this route means any bookmarks to /preview/<id> still work.

import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PreviewPage({ params }: Props) {
  const { id } = await params;
  redirect(`/analysis/${id}`);
}
