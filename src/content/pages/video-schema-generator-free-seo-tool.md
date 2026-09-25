---
title: Video Schema Generator (Free SEO Tool)
description: Generate free Video Schema Markup (JSON-LD) for your YouTube videos. Boost your SEO and get Google Rich Snippets instantly. Try our tool right here!
published: 2026-04-09T20:42:00.000+02:00
updated: 2026-04-11T13:04:49.749+02:00
bloggerId: "5104906923224009179"
---
<div class="schema-seo-text" style="max-width: 800px; margin: 0 auto 30px auto; font-family: inherit; line-height: 1.6;">
  <p>Do you want your YouTube videos to stand out in Google search results with eye-catching "Rich Snippets"? With Tech Media Arch's free Video Schema Generator, you can instantly create the correct JSON-LD code for your blog or website.</p>
  <p>Simply paste your YouTube link, and let our tool fetch all the necessary data automatically via the YouTube API. No more manual entry of complex ISO 8601 time formats or searching for thumbnail URLs!</p>
</div>

<style>
  #bottomAlert {
  display: none !important;
}
  /* Tool Design */
  .schema-tool-container {
    max-width: 800px;
    margin: 0 auto 40px auto;
    font-family: inherit;
    background: #f9f9f9;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  }
  .schema-tool-container h2 { margin-top: 0; color: #333; }
  .schema-tool-container input {
    width: 100%;
    padding: 15px;
    margin-bottom: 15px;
    border: 1px solid #ccc;
    border-radius: 8px;
    font-size: 16px;
    box-sizing: border-box;
  }
  .schema-tool-container button {
    width: 100%;
    padding: 15px;
    background: #a73eb9; /* Din valgte farve */
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.3s;
  }
  .schema-tool-container button:hover { background: #cc0000; }
  .schema-tool-container textarea {
    width: 100%;
    height: 300px;
    margin-top: 20px;
    padding: 15px;
    font-family: monospace;
    font-size: 14px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #282c34;
    color: #abb2bf;
    box-sizing: border-box;
    display: none;
  }
  .schema-loader { display: none; margin-top: 15px; font-weight: bold; color: #555; }
</style>

<div class="schema-tool-container">
  <h2>⚡ Generate Your Code Here</h2>
  <input type="text" id="yt-url" placeholder="Paste YouTube URL here (e.g., https://youtube.com/watch?v=...)">
  <button onclick="generateSchema()" id="generate-btn">Generate Video Schema</button>
  <div class="schema-loader" id="loader">Fetching data from YouTube... ⏳</div>
  <textarea id="schema-output" readonly></textarea>
</div>

<script>
  // REMEMBER TO INSERT YOUR API KEY HERE:
  const API_KEY = 'AIzaSyDb5xWKydT9w8HC4KGJhyQEmZ0-sTWt1_Y';

  function extractVideoID(url) {
    let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    let match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  async function generateSchema() {
    const urlInput = document.getElementById('yt-url').value;
    const videoId = extractVideoID(urlInput);
    const outputField = document.getElementById('schema-output');
    const loader = document.getElementById('loader');
    
    if (!videoId) {
      alert("Please enter a valid YouTube URL.");
      return;
    }

    loader.style.display = "block";
    outputField.style.display = "none";

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${API_KEY}`);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const video = data.items[0];
        const snippet = video.snippet;
        const details = video.contentDetails;

        const schema = {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          "name": snippet.title,
          "description": snippet.description.substring(0, 200) + "...",
          "thumbnailUrl": [
            snippet.thumbnails.maxres ? snippet.thumbnails.maxres.url : snippet.thumbnails.high.url
          ],
          "uploadDate": snippet.publishedAt,
          "duration": details.duration,
          "contentUrl": `https://www.youtube.com/watch?v=${videoId}`,
          "embedUrl": `https://www.youtube.com/embed/${videoId}`
        };

        outputField.value = "<script type=\"application/ld+json\">\n" + JSON.stringify(schema, null, 2) + "\n<\/script>";
        outputField.style.display = "block";
      } else {
        alert("Could not find the video. Please check if it is private.");
      }
    } catch (error) {
      alert("An error occurred. Did you remember to insert your API key in the code?");
      console.error(error);
    } finally {
      loader.style.display = "none";
    }
  }
</script>

<div class="schema-seo-text" style="max-width: 800px; margin: 0 auto; font-family: inherit; line-height: 1.6;">
  <h2>What is Video Schema Markup?</h2>
  <p>Video Schema (also known as VideoObject in Schema.org) is a piece of structured data you add to the HTML of your website. It communicates directly with search engines like Google, Bing, and Yahoo, telling them exactly what your video is about, its duration, publication date, and which cover image it uses.</p>
  
  <h2>Why is it Important for SEO?</h2>
  <p>By implementing Video Schema Markup, you significantly increase the chances of Google displaying your video as a "Rich Result" directly in the SERPs (Search Engine Results Pages). A Rich Result typically includes a large video thumbnail and a play button. This visually appealing format captures user attention, dramatically improves your Click-Through-Rate (CTR), and boosts your article's overall authority.</p>

  <h2>How to Use the Tool:</h2>
  <ol>
    <li>Find the YouTube video you want to embed on your blog or website.</li>
    <li>Copy the video link and paste it into the input field above.</li>
    <li>Click <strong>"Generate Video Schema"</strong>.</li>
    <li>Copy the generated JSON-LD code from the dark output box.</li>
    <li>Paste the code into the HTML view of your blog post or article – preferably right below your embedded video.</li>
  </ol>
  
  <p><em>Pro Tip: Always test your generated code in the <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener">Google Rich Results Test Tool</a> to ensure it gets the green checkmark before hitting publish!</em></p>
</div>
