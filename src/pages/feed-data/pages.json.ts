// De faste sider (Bloggers /feeds/pages/default). Bruges af workeren.
import { feedSider } from '../../lib/bloggerfeed';
export const GET = () => new Response(JSON.stringify(feedSider()), { headers: { 'Content-Type': 'application/json' } });
