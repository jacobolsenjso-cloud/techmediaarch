// Indlæg med etiketten "Video" MED brødtekst (Bloggers /feeds/posts/default/-/Video).
// Watch-siden finder YouTube-videoen i brødteksten, så den skal med her.
import { feedMedIndhold } from '../../lib/bloggerfeed';
export const GET = () => new Response(JSON.stringify(feedMedIndhold('Video')), { headers: { 'Content-Type': 'application/json' } });
