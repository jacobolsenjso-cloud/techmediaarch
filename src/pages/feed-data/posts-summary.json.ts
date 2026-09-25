// Alle indlæg uden brødtekst (Bloggers /feeds/posts/summary). Bruges af workeren.
import { feedResume } from '../../lib/bloggerfeed';
export const GET = () => new Response(JSON.stringify(feedResume()), { headers: { 'Content-Type': 'application/json' } });
