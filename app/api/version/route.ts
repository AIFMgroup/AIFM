/**
 * Deployment version check – använd för att verifiera att ny frontend är live.
 * När chatUiVersion >= 2 har chatten längdknappar (Kort/Medel/Långt) och streaming-progress.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    chatUiVersion: 2,
    build: '2026-02-12',
  });
}
