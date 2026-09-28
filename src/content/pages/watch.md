---
title: Watch
description: Dive into in-depth tech videos and AI analysis. Access Tech Media Arch's comprehensive video hub with guides and news for the future of tech.
published: 2026-04-16T18:11:00.000+02:00
updated: 2026-09-05T14:27:32.012+02:00
bloggerId: "3089933252946304987"
---
<style>
/* =========================================
   SKJUL DEN GAMLE GLOBALE DISCLAIMER 
   ========================================= */
p.affiliate-disclaimer { display: none !important; }

/* =========================================
   1. LAYOUT & CONTAINER (Trækker siden helt op!)
   ========================================= */
.watch-library-container {
    width: 100vw !important; 
    max-width: 100vw !important; 
    position: relative !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    padding: 0 15px !important; 
    margin-top: -35px !important;
    box-sizing: border-box !important;
}
@media (min-width: 1200px) {
    .watch-library-container {
        max-width: var(--container, 1200px) !important; 
    }
}

.tma-watch-layout {
    display: grid !important;
    grid-template-columns: 7fr 3fr !important; 
    gap: 25px !important; 
    margin-bottom: 40px !important;
    align-items: start !important;
    width: 100% !important;
}

.tma-video-column {
    width: 100% !important;
    max-width: 100% !important;
}

/* =========================================
   PREMIUM LØBETEKST (REN & DISKRET) 
   ========================================= */
h1.post-title, h1.entry-title, .post-header { display: none !important; }

.tma-news-ticker {
    width: 100%;
    margin-bottom: 25px !important;
    background: transparent !important; 
    border: none !important; 
    padding: 5px 0 !important; 
    overflow: hidden; 
    display: flex;
    align-items: center;
    white-space: nowrap;
}

.ticker-content {
    display: inline-block;
    padding-left: 100%; 
    animation: ticker-scroll 30s linear infinite; 
    font-size: 13px !important;
    font-weight: 400 !important; 
    color: var(--text-color, #4b5563) !important;
    font-family: var(--body-font, sans-serif) !important;
    text-transform: none !important; 
}

html.is-dark .ticker-content { color: #cbd5e1 !important; }

.tma-news-ticker:hover .ticker-content,
.tma-news-ticker:active .ticker-content { animation-play-state: paused; }

@keyframes ticker-scroll {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(-100%, 0, 0); } 
}

/* =========================================
   PROFESSIONELT REKLAME-DESIGN (SIKKER METODE)
   ========================================= */
.watch-library-container > .google-auto-placed,
.tma-watch-layout .google-auto-placed {
    display: none !important;
    height: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

.tma-ad-box {
    background: var(--gray-bg, #f8fafc) !important;
    border: 1px dashed var(--border-color, #cbd5e1) !important;
    border-radius: 8px !important;
    padding: 10px 0 5px 0 !important;
    margin: 0 auto 30px auto !important;
    display: block !important; 
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    text-align: center !important;
    overflow: hidden !important; 
}

.tma-ad-box ins.adsbygoogle {
    display: block !important;
    margin: 0 auto !important;
    max-width: 100% !important;
}

.tma-ad-box ins iframe { max-width: 100% !important; }

html.is-dark .tma-ad-box {
    background: var(--rgba-0d, #1a1a1a) !important;
    border-color: var(--rgba-33, #333) !important;
}

.tma-ad-box::before {
    content: '- Advertisement -';
    display: block !important;
    font-size: 9px !important; 
    text-transform: uppercase !important;
    color: var(--summary-color, #999) !important;
    margin-bottom: 5px !important; 
    letter-spacing: 1px !important;
    font-family: var(--body-font, sans-serif) !important;
    text-align: center !important;
    width: 100% !important;
}

/* =========================================
   GRID-REKLAMER (Dynamisk indsat)
   ========================================= */
.tma-grid-ad {
    grid-column: 1 / -1 !important; 
    width: 100% !important;
    margin: 10px 0 !important;
    display: flex;
    justify-content: center;
}

@media (min-width: 651px) {
    .ad-mobile-only {
        display: none !important;
    }
}

/* =========================================
   2. VENSTRE SIDE: VIDEO AFSPILLER & GLOW
   ========================================= */
.tma-video-wrapper {
    position: relative !important; 
    width: 100% !important;
    padding-bottom: 56.25% !important; 
    height: 0 !important; 
    overflow: hidden !important; 
    border-radius: var(--radius, 8px) !important;
    background: #000 !important;
    box-shadow: 0 10px 35px rgba(54, 105, 233, 0.2), 0 0 20px rgba(212, 42, 158, 0.1) !important;
    border: 1px solid rgba(255,255,255,0.05) !important;
}
html.is-dark .tma-video-wrapper { box-shadow: 0 10px 45px rgba(54, 105, 233, 0.35), 0 0 30px rgba(212, 42, 158, 0.15) !important; }

.tma-video-wrapper iframe, .tma-lazy-cover {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    border: none !important;
}

.tma-lazy-cover { cursor: pointer; background-color: #000; background-size: cover; background-position: center; }

.tma-play-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 68px;
    height: 48px;
    background-color: #ff0000;
    border-radius: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    transition: transform 0.2s;
}

.tma-lazy-cover:hover .tma-play-btn { transform: translate(-50%, -50%) scale(1.1); }

.tma-main-title {
    font-size: 1.6rem !important;
    font-weight: var(--title-weight, 700) !important;
    margin: 0 !important;
    color: var(--title-color, #111) !important;
    font-family: var(--title-font, sans-serif) !important;
    line-height: 1.3 !important;
    text-align: left !important;
}

/* =========================================
   3. PREMIUM CTA-KNAP & DISCLAIMER
   ========================================= */
.tma-copy-btn-wide {
    background: linear-gradient(90deg, #1bceca, #3669e9, #d42a9e) !important;
    color: #ffffff !important;
    border: none !important;
    padding: 14px 30px !important;
    border-radius: 12px !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 10px !important;
    font-size: 14px !important;
    font-weight: 800 !important;
    font-family: var(--body-font, sans-serif) !important;
    width: auto !important;
    min-width: 220px !important;
    margin-top: 15px !important;
    text-transform: uppercase !important;
    letter-spacing: 1px !important;
    box-shadow: 0 4px 15px rgba(54, 105, 233, 0.25) !important;
    transition: all 0.4s ease !important;
}

.tma-copy-btn-wide:hover { 
    transform: translateY(-4px) !important;
    box-shadow: 0 10px 25px rgba(212, 42, 158, 0.4) !important;
    filter: brightness(1.15) !important;
}
.tma-copy-btn-wide svg { fill: #ffffff !important; }

.tma-watch-disclaimer {
    background-color: var(--gray-bg, #f8fafc);
    border-radius: 6px !important; 
    border: 1px dashed var(--border-color, #ccc);
    color: var(--summary-color, #666);
    font-size: 0.75rem !important; 
    line-height: 1.4 !important; 
    font-style: italic;
    margin-top: 15px !important; 
    padding: 10px 14px !important; 
    text-align: left;
    width: 100%;
    box-sizing: border-box;
}
.tma-watch-disclaimer strong { color: var(--title-color, #111); font-style: normal; font-weight: 700; }

/* =========================================
   4. HØJRE SIDE: RECOMMENDED
   ========================================= */
.tma-sidebar-title {
    font-size: 1.1rem !important;
    font-weight: var(--title-weight, 700) !important;
    margin: 0 0 15px 0 !important;
    padding-bottom: 10px !important;
    border-bottom: 2px solid var(--border-color, #eee) !important;
    color: var(--title-color, #111) !important;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
}

.swipe-indicator { display: none; font-size: 0.75rem !important; color: var(--accent-color, #3669e9) !important; font-weight: 700 !important; text-transform: uppercase !important; letter-spacing: 1px !important; align-items: center !important; gap: 5px !important; }
@keyframes swipe-arrow { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(5px); } }

.tma-recommended-column { width: 100%; max-height: 480px; overflow-y: auto; overflow-x: hidden; padding-right: 5px; }
.tma-recommended-column::-webkit-scrollbar { width: 6px; }
.tma-recommended-column::-webkit-scrollbar-thumb { background: #ccc; border-radius: 5px; }
#recommended-videos-container { display: flex; flex-direction: column; gap: 10px; }

.rec-card { display: flex; gap: 12px; cursor: pointer; padding: 8px; border-radius: 8px; transition: background 0.2s; position: relative; text-decoration: none !important; color: inherit !important; }
.rec-card:hover { background: var(--gray-bg, #f8fafc); }

.rec-img-wrap { flex: 0 0 120px; position: relative; aspect-ratio: 16/9; background-color: #000; background-size: cover; background-position: center; border-radius: 6px; overflow: hidden; }
.watch-card-thumb { position: relative; aspect-ratio: 16/9; background-color: #000; background-size: cover; background-position: center; pointer-events: none; }
.rec-text-wrap { flex: 1; display: flex; flex-direction: column; justify-content: center !important; }

/* FIX: Tvinger h4-tags i Recommended-menuen til at ignorere det globale temas bund-margin */
.tma-sidebar-wrapper h4.tma-rec-title { font-size: 13px !important; font-weight: 600 !important; margin: 0 !important; display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; line-height: 1.3 !important; color: var(--title-color, #111) !important; padding: 0 !important; }

.tma-rec-title a, #dynamic-watch-grid h3.tma-grid-title a { color: inherit !important; text-decoration: none !important; pointer-events: none; }

/* =========================================
   5. KORT, SØG & FILTRE
   ========================================= */
.watch-controls-container { background: var(--outer-bg, #fff) !important; border: 1px solid var(--border-color, #eee) !important; display: flex; justify-content: space-between; align-items: center; margin: 0 0 30px 0; flex-wrap: wrap; gap: 15px; padding: 15px; border-radius: 12px; }
.watch-search-input { padding: 10px 15px !important; border-radius: 20px !important; width: 100%; max-width: 250px !important; outline: none !important; background: var(--outer-bg, #fff) !important; color: var(--title-color, #333) !important; border: 1px solid var(--border-color, #ddd) !important; }
.tma-filter-btn { font-family: var(--body-font, sans-serif) !important; font-size: .75rem !important; color: var(--title-color, #4c4d4e) !important; font-weight: 500 !important; border: 2px solid var(--accent-color, #3669e9) !important; padding: 6px 14px !important; border-radius: 20px !important; transition: all .4s ease !important; background: transparent !important; margin: 4px 4px 4px 0 !important; cursor: pointer !important; }
.tma-filter-btn:hover, .tma-filter-btn.active { background: var(--accent-color, #3669e9) !important; color: var(--white-color, #fff) !important; border-color: var(--accent-color, #3669e9) !important; }
.tma-filter-select { display: none; padding: 10px 15px !important; border-radius: 20px !important; border: 1px solid var(--border-color, #ddd) !important; background: var(--outer-bg, #fff) !important; color: var(--title-color, #333) !important; font-family: var(--body-font, sans-serif) !important; font-size: 0.85rem !important; width: 100%; max-width: 250px; outline: none !important; cursor: pointer; }
.tma-filter-buttons-wrapper { display: flex; flex-wrap: wrap; gap: 8px; }

#dynamic-watch-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 20px !important; align-items: start; margin-bottom: 40px; }
.watch-card { background: var(--outer-bg, #fff) !important; border: 1px solid var(--border-color, #eee) !important; border-radius: var(--radius, 8px) !important; cursor: pointer; transition: transform 0.2s; overflow: hidden; position: relative; display: block; text-decoration: none !important; color: inherit !important; }
.watch-card-play { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; font-size: 2.5rem; opacity: 0.8; text-shadow: 0px 2px 5px rgba(0,0,0,0.5); z-index: 2; }

/* FAST STØRRELSE PÅ KORTENE & MAX 5 LINJER - OPTIMERET TIL AT OVERSTYRE DET GLOBALE TEMA */
.tma-card-tag, .tma-card-date, .tma-card-summary { display: none !important; }
.watch-card-info { 
    padding: 10px 12px !important; 
    height: 120px !important; 
    box-sizing: border-box !important;
    pointer-events: none; 
}

/* FIX: Bruger stærk specificitet (ved at angive #dynamic-watch-grid) for at dræbe temaets indbyggede margin-top på h3! */
#dynamic-watch-grid h3.tma-grid-title { 
    margin: 0 !important; 
    padding: 0 !important;
    font-size: 14px !important; 
    line-height: 1.4 !important; 
    display: -webkit-box !important;
    -webkit-line-clamp: 5 !important; 
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
}

/* =========================================
   MOBIL TILPASNING
   ========================================= */
@media (max-width: 991px) {
    .watch-library-container { margin-top: -65px !important; }
    .tma-watch-layout { grid-template-columns: 1fr !important; gap: 15px !important; width: 100% !important; max-width: 100vw !important; overflow: hidden !important; }
    .tma-video-column { width: 100% !important; max-width: 100% !important; padding: 0 !important; }
    .tma-video-wrapper { width: 100% !important; max-width: 100% !important; padding-bottom: 56.25% !important; height: 0 !important; }
    .tma-sidebar-wrapper { width: 100% !important; max-width: 100vw !important; margin-top: 10px !important; overflow: hidden !important; }
    .tma-recommended-column { width: 100% !important; max-height: none !important; overflow: visible !important; }
    #recommended-videos-container { display: flex !important; flex-wrap: nowrap !important; flex-direction: row !important; overflow-x: auto !important; overflow-y: hidden !important; padding-bottom: 15px !important; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; gap: 15px !important; }
    #recommended-videos-container::-webkit-scrollbar { display: none !important; }
    .rec-card { flex: 0 0 75% !important; max-width: 280px !important; flex-direction: column !important; scroll-snap-align: start; background: var(--outer-bg, #ffffff) !important; border: 1px solid var(--border-color, #e2e8f0) !important; box-shadow: 0 4px 10px rgba(0,0,0,0.05) !important; white-space: normal !important; gap: 8px !important; padding: 8px !important; }
    .rec-img-wrap { flex: none !important; width: 100% !important; aspect-ratio: 16/9 !important; padding-bottom: 0 !important; height: auto !important; position: relative !important; background-size: cover !important; background-position: center !important; }
    .swipe-indicator { display: flex !important; }
    .swipe-indicator svg { animation: swipe-arrow 1.5s infinite; }
    p#watch-disclaimer.tma-watch-disclaimer { font-size: 11px !important; line-height: 1.3 !important; padding: 8px 10px !important; margin-top: 15px !important; border-radius: 6px !important; }
    p#watch-disclaimer.tma-watch-disclaimer strong { font-size: 11px !important; }
}

@media (max-width: 650px) {
    #dynamic-watch-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
    #dynamic-watch-grid h3.tma-grid-title { font-size: 13px !important; line-height: 1.4 !important; }
    .watch-card-info { height: 115px !important; padding: 10px 8px !important; } 
    .tma-video-column > div:nth-child(2) { align-items: flex-start !important; width: 100% !important; }
    .tma-main-title { text-align: left !important; align-self: flex-start !important; width: 100% !important; font-size: 1.25rem !important; margin-bottom: 15px !important; }
    .tma-copy-btn-wide { margin: 0 auto !important; width: auto !important; min-width: 250px !important; }
    .tma-filter-buttons-wrapper { display: none !important; }
    .tma-filter-select { display: block !important; }
}
@media (max-width: 480px) { .watch-search-input { max-width: 100% !important; } }

html.is-dark .tma-main-title, html.is-dark .tma-sidebar-title, html.is-dark #dynamic-watch-grid h3.tma-grid-title, html.is-dark .tma-sidebar-wrapper h4.tma-rec-title { color: #fff !important; }
html.is-dark .rec-card { border-color: var(--rgba-33, #333); }
html.is-dark .rec-card:hover { background: var(--rgba-33, #333); }
</style>

<link rel="preload" as="script" href="/feeds/posts/default/-/Video?alt=json-in-script&amp;callback=initWatchLibrary&amp;max-results=50" />
<div class="watch-library-container">
    
    <div class="tma-news-ticker">
        <div class="ticker-content">
            Welcome to our extensive tech video library. Explore the latest technology videos, vlogs, in-depth reviews, and helpful guides. Use the filters or the search bar below to easily find the exact content you’re looking for.
        </div>
    </div>

    <div class="tma-ad-box">
        <ins class="adsbygoogle" data-ad-client="ca-pub-9695260339642032" data-ad-format="auto" data-ad-slot="9307491837" data-full-width-responsive="false" style="display: block;"></ins> 
        <script>
             (adsbygoogle = window.adsbygoogle || []).push({});
        </script>
    </div>

    <div class="watch-controls-container">
        <div id="filter-container"></div>
        <input class="watch-search-input" id="video-search" placeholder="Søg videoer..." type="text" />
    </div>
    
    <div class="tma-watch-layout" id="tma-watch-layout">
        <div class="tma-video-column">
            <div class="tma-video-wrapper" id="video-wrapper"></div>
            <div style="align-items: flex-start; display: flex; flex-direction: column; margin-top: 15px;">
                <h2 class="tma-main-title" id="current-video-title">Vælg en video...</h2>
                <button class="tma-copy-btn-wide" id="copy-video-link-btn" style="display: none;">
                    <svg fill="currentColor" height="18" viewbox="0 0 16 16" width="18"><path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"></path></svg>
                    <span id="copy-btn-text"> Share this video</span>
                </button>
                
                <p class="tma-watch-disclaimer" id="watch-disclaimer" style="display: none;">
                    <strong>Disclaimer:</strong> This "Watch" page may contain videos that contain affiliate links. If you purchase through these links, TechMediaArch.com may earn a small commission at no additional cost to you.
                </p>
            </div>
        </div>
        
        <div class="tma-sidebar-wrapper" style="width: 100%;">
            <div class="tma-sidebar-title">
                Recommended Videos
                <span class="swipe-indicator">Swipe <svg fill="none" height="14" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" stroke="currentColor" viewbox="0 0 24 24" width="14"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></span>
            </div>
            <div class="tma-recommended-column">
                <div id="recommended-videos-container">
                    <p class="rec-container-text">Indlæser anbefalinger...</p>
                </div>
            </div>
        </div>
    </div>
    
    <div class="tma-ad-box">
        <ins class="adsbygoogle" data-ad-client="ca-pub-9695260339642032" data-ad-format="auto" data-ad-slot="9307491837" data-full-width-responsive="false" style="display: block;"></ins> 
        <script>
             (adsbygoogle = window.adsbygoogle || []).push({});
        </script>
    </div>

    <div id="dynamic-watch-grid">
        <p class="rec-container-text">Indlæser bibliotek...</p>
    </div>
</div>

<script type="text/javascript">
//<![CDATA[
(function() {
    var allVideos = [];
    var currentFilter = 'All';
    
    // AEO/SEO FIX: JSON-LD strukturdata generator (Bygger usynlig liste for AI og Google)
    function injectVideoSchema(videos) {
        var existingSchema = document.getElementById('tma-dynamic-schema');
        if (existingSchema) existingSchema.remove();

        var schemaItems = videos.map(function(v, index) {
            return {
                "@type": "ListItem",
                "position": index + 1,
                "item": {
                    "@type": "VideoObject",
                    "name": v.title,
                    "description": v.summary || v.title,
                    "thumbnailUrl": "https://img.youtube.com/vi/" + v.id + "/maxresdefault.jpg",
                    "uploadDate": v.date ? new Date(v.date).toISOString() : new Date().toISOString(),
                    "contentUrl": v.url,
                    "embedUrl": "https://www.youtube.com/embed/" + v.id
                }
            };
        });

        var schemaJSON = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": schemaItems
        };

        var scriptTag = document.createElement('script');
        scriptTag.id = 'tma-dynamic-schema';
        scriptTag.type = 'application/ld+json';
        scriptTag.text = JSON.stringify(schemaJSON);
        document.head.appendChild(scriptTag);
    }
    
    window.initWatchLibrary = function(data) {
        var entries = data.feed.entry || [];
        var ytRegex = /(?:youtu.be\/|youtube(?:-nocookie)?.com\/(?:embed\/|v\/|watch\?v=|watch\?[^"'\s]*?&v=))([a-zA-Z0-9_-]{11})/i;
        
        allVideos = entries.map(function(entry) {
            var content = entry.content ? entry.content.$t : '';
            var match = content.match(ytRegex);
            var tag = 'Video';
            
            if (entry.category) {
                for (var i = 0; i < entry.category.length; i++) {
                    if (entry.category[i].term !== 'Video') { tag = entry.category[i].term; break; }
                }
            }
            
            var postUrl = '';
            if (entry.link) {
                for (var j = 0; j < entry.link.length; j++) {
                    if (entry.link[j].rel === 'alternate') { postUrl = entry.link[j].href; break; }
                }
            }
            
            var publishedDate = entry.published ? entry.published.$t : '';
            var summary = entry.summary && entry.summary.$t.trim() !== '' ? entry.summary.$t : (entry.content ? entry.content.$t.replace(/<[^>]*>?/gm, '').substring(0, 160) + '...' : '');
            
            return { title: entry.title.$t, id: match ? match[1] : null, tag: tag, url: postUrl, date: publishedDate, summary: summary };
        }).filter(function(v) { return v.id !== null; });
        
        if (allVideos.length === 0) return;
        
        // Aktiverer den usynlige AI/SEO data her
        injectVideoSchema(allVideos); 
        
        renderFilters();
        renderGrid(allVideos);
        loadVideoInPlayer(allVideos[0].id, allVideos[0].title, allVideos[0].url, false);
    };
    
    function loadVideoInPlayer(id, title, url, autoPlay) {
        var wrapper = document.getElementById('video-wrapper');
        var titleEl = document.getElementById('current-video-title');
        
        if (!wrapper) return;
        if (titleEl) titleEl.innerText = title; 
        
        var copyBtn = document.getElementById('copy-video-link-btn');
        var disclaimer = document.getElementById('watch-disclaimer');
        
        if (copyBtn && url) {
            copyBtn.setAttribute('data-url', url);
            document.getElementById('copy-btn-text').innerText = ' Share this video'; 
            copyBtn.style.display = 'flex'; 
            if(disclaimer) disclaimer.style.display = 'block';
        }
        
        var iframeSrc = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&mute=0&rel=0&modestbranding=1&controls=1&showinfo=0&origin=' + window.location.origin;
        
        if (autoPlay === true) {
            wrapper.innerHTML = '<iframe style="position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; border: none !important;" allowfullscreen="true" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" src="' + iframeSrc + '"></iframe>';
            
            var controlsSection = document.querySelector('.watch-controls-container');
            if (controlsSection) {
                customSmoothScrollTo(tmaTargetY(controlsSection, 100), 800); 
            }
        } else {
            var coverHtml = '<div class="tma-lazy-cover" style="background-image:url(https://img.youtube.com/vi/' + id + '/maxresdefault.jpg);"><div class="tma-play-btn"><svg width="35" height="35" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div></div>';
            wrapper.innerHTML = coverHtml;
            var coverEl = wrapper.querySelector('.tma-lazy-cover');
            coverEl.addEventListener('click', function() {
                wrapper.innerHTML = '<iframe style="position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; border: none !important;" allowfullscreen="true" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" src="' + iframeSrc + '"></iframe>';
            });
        }
        renderRecommended(id);
    }
    
    function renderRecommended(currentVideoId) {
        var recContainer = document.getElementById('recommended-videos-container');
        if (!recContainer) return;
        
        var recommendations = allVideos.filter(function(v) { return v.id !== currentVideoId; }).slice(0, 15);
        
        recContainer.innerHTML = recommendations.map(function(v) {
            var cleanTitle = v.title.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
            var targetUrl = v.url || '#';
            
            // TILBAGE TIL ORIGINAL: Bevarer dit eget kode 100 % urørt i kasserne
            return '<div class="rec-card click-to-play" data-vid="' + v.id + '" data-vtitle="' + cleanTitle + '" data-vurl="' + v.url + '"><div class="rec-img-wrap tma-lazy-bg" data-bg="https://img.youtube.com/vi/' + v.id + '/mqdefault.jpg"></div><div class="rec-text-wrap"><h4 class="tma-rec-title"><a href="' + targetUrl + '">' + v.title + '</a></h4></div></div>';
        }).join('');
        lazyBackgrounds(recContainer, 4);
    }

    // Miniaturer hentes først når kortet er tæt på skærmen (sparer 30-40 billed-kald ved sidestart).
    // Udseendet er uændret: samme CSS, samme billede - kun tidspunktet for hentning ændres.
    var tmaBgObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var el = entry.target;
                el.style.backgroundImage = 'url(' + el.getAttribute('data-bg') + ')';
                el.classList.remove('tma-lazy-bg');
                tmaBgObserver.unobserve(el);
            }
        });
    }, { rootMargin: '300px 0px' }) : null;
    // Sikkerhedsnet: ved scroll/resize hentes alle ventende miniaturer, der er inden for skærmen (+300 px),
    // også hvis IntersectionObserver af en eller anden grund ikke har reageret.
    var tmaBgTick = false;
    function tmaLoadVisiblePending() {
        tmaBgTick = false;
        var pend = document.querySelectorAll('.tma-lazy-bg[data-bg]');
        var h = window.innerHeight || 800;
        pend.forEach(function(el) {
            var r = el.getBoundingClientRect();
            if (r.bottom > -300 && r.top < h + 300 && r.right > 0 && r.left < (window.innerWidth || 400)) {
                el.style.backgroundImage = 'url(' + el.getAttribute('data-bg') + ')';
                el.classList.remove('tma-lazy-bg');
                if (tmaBgObserver) { tmaBgObserver.unobserve(el); }
            }
        });
    }
    function tmaBgOnScroll() { if (!tmaBgTick) { tmaBgTick = true; setTimeout(tmaLoadVisiblePending, 80); } }
    document.addEventListener('scroll', tmaBgOnScroll, { capture: true, passive: true }); // capture: fanger også scroll inde i anbefalings-rækken på mobil
    window.addEventListener('resize', tmaBgOnScroll, { passive: true });
    function lazyBackgrounds(root, eagerCount) {
        // De første kort (dem der ligger øverst) hentes med det samme, resten når man scroller til dem.
        var els = root.querySelectorAll('.tma-lazy-bg[data-bg]');
        var eager = (typeof eagerCount === 'number') ? eagerCount : 0;
        els.forEach(function(el, idx) {
            if (idx < eager || !tmaBgObserver) {
                el.style.backgroundImage = 'url(' + el.getAttribute('data-bg') + ')';
                el.classList.remove('tma-lazy-bg');
            } else {
                tmaBgObserver.observe(el);
            }
        });
    }
    
    function generateAdHTML(visibilityClass) {
        return '<div class="tma-grid-ad ' + visibilityClass + '">' +
                 '<div class="tma-ad-box" style="margin-bottom:0 !important; border: 1px dashed #cbd5e1 !important;">' +
                     '<ins class="adsbygoogle" ' +
                          'style="display:block" ' +
                          'data-ad-client="ca-pub-9695260339642032" ' +
                          'data-ad-slot="5368246827" ' +
                          'data-ad-format="horizontal" ' +
                          'data-full-width-responsive="false"></ins>' +
                 '</div>' +
               '</div>';
    }

    function renderGrid(videos) {
        var container = document.getElementById('dynamic-watch-grid');
        if (!container) return;
        
        var htmlString = '';
        
        for (var i = 0; i < videos.length; i++) {
            var v = videos[i];
            var cleanTitle = v.title.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
            var targetUrl = v.url || '#';
            
            // TILBAGE TIL ORIGINAL: Bevarer dit eget kode 100 % urørt i kasserne
            htmlString += '<div class="watch-card click-to-play" data-vid="' + v.id + '" data-vtitle="' + cleanTitle + '" data-vurl="' + v.url + '"><div class="watch-card-thumb tma-lazy-bg" data-bg="https://img.youtube.com/vi/' + v.id + '/mqdefault.jpg"><div class="watch-card-play">▶</div></div><div class="watch-card-info"><h3 class="tma-grid-title"><a href="' + targetUrl + '">' + v.title + '</a></h3></div></div>';
            
            var pos = i + 1;
            
            // Kun 2 annoncer i grid'et (efter video 9 og 27) - samme enhed på både mobil og desktop.
            // Før: op til ~20 pladser med samme annonce-id; Google fylder alligevel kun få af dem,
            // og de skjulte mobil-pladser gav fejlen "No slot size for availableWidth=0" på desktop.
            if (pos !== videos.length && (pos === 9 || pos === 27)) {
                htmlString += generateAdHTML('ad-desktop-mobile');
            }
        }
        
        container.innerHTML = htmlString;
        lazyBackgrounds(container, 6);
        setTimeout(tmaLoadVisiblePending, 400);
        
        var newAds = container.querySelectorAll('.tma-grid-ad .adsbygoogle');
        // Annoncen hentes først når pladsen er tæt på skærmen OG har en bredde.
        // (Før blev Google spurgt med det samme, mens pladsen stadig var 0 px bred -> ingen annonce.)
        function requestAd(ad, attempt) {
            if (ad.getAttribute('data-adsbygoogle-status')) return; // allerede behandlet
            if (ad.offsetWidth < 100) {
                if (attempt < 10) setTimeout(function() { requestAd(ad, attempt + 1); }, 300);
                return;
            }
            try {
                (adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.error("AdSense Error:", e);
            }
        }
        if ('IntersectionObserver' in window) {
            var adObserver = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        adObserver.unobserve(entry.target);
                        requestAd(entry.target, 0);
                    }
                });
            }, { rootMargin: '400px 0px' });
            newAds.forEach(function(ad) { adObserver.observe(ad); });
        } else {
            newAds.forEach(function(ad) { requestAd(ad, 0); });
        }
    }
    
    function renderFilters() {
        var filterContainer = document.getElementById('filter-container');
        if (!filterContainer) return;
        
        var tags = ['All'];
        allVideos.forEach(function(v) { if (tags.indexOf(v.tag) === -1) tags.push(v.tag); });
        
        var buttonsHtml = tags.map(function(t) { return '<button class="tma-filter-btn ' + (t === 'All' ? 'active' : '') + '" data-tag="' + t + '">' + t + '</button>'; }).join('');
        var selectHtml = '<select class="tma-filter-select" id="mobile-filter-select">' + tags.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('') + '</select>';
        
        filterContainer.innerHTML = '<div class="tma-filter-buttons-wrapper">' + buttonsHtml + '</div>' + selectHtml;
    }
    
    function applySearchAndFilter() {
        var searchInput = document.getElementById('video-search');
        var searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        var filtered = allVideos.filter(function(v) {
            var matchesTag = (currentFilter === 'All' || v.tag === currentFilter);
            var matchesSearch = v.title.toLowerCase().indexOf(searchTerm) !== -1;
            return matchesTag && matchesSearch;
        });
        
        renderGrid(filtered);
    }

    // Astro-sitet ruller inde i boksen .content-area, ikke i vinduet (som på Blogger).
    // Derfor rulles boksen, hvis den findes; ellers vinduet som før.
    function tmaScroller() { return document.querySelector('.content-area'); }
    function tmaScrollY() { var b = tmaScroller(); return b ? b.scrollTop : (window.scrollY || window.pageYOffset); }
    // Rul-position, der lægger elementet headerOffset px under skærmens top (samme luft som på Blogger)
    function tmaTargetY(el, headerOffset) { return el.getBoundingClientRect().top + tmaScrollY() - headerOffset; }

    function customSmoothScrollTo(targetY, duration) {
        var startY = tmaScrollY();
        var difference = targetY - startY;
        var startTime = null;
        var scroller = tmaScroller();

        function step(currentTime) {
            if (!startTime) startTime = currentTime;
            var progress = currentTime - startTime;
            var percentage = Math.min(progress / duration, 1);
            
            var ease = percentage < 0.5 ? 2 * percentage * percentage : -1 + (4 - 2 * percentage) * percentage;
            
            // 'instant', fordi boksen selv har scroll-behavior: smooth, som ellers ville kæmpe imod
            if (scroller) scroller.scrollTo({ top: startY + difference * ease, behavior: 'instant' });
            else window.scrollTo(0, startY + difference * ease);
            
            if (progress < duration) {
                window.requestAnimationFrame(step);
            }
        }
        window.requestAnimationFrame(step);
    }

    function scrollToGrid() {
        setTimeout(function() {
            var gridContainer = document.getElementById('dynamic-watch-grid');
            if (gridContainer) {
                customSmoothScrollTo(tmaTargetY(gridContainer, 100), 800); 
            }
        }, 50); 
    }
    
    document.addEventListener("DOMContentLoaded", function() {
        
        document.addEventListener('click', function(e) {
            var card = e.target.closest('.click-to-play');
            if (card) { 
                e.preventDefault();
                loadVideoInPlayer(card.getAttribute('data-vid'), card.getAttribute('data-vtitle'), card.getAttribute('data-vurl'), true); 
            }
        });
        
        var filterContainer = document.getElementById('filter-container');
        if (filterContainer) {
            filterContainer.addEventListener('click', function(e) {
                var btn = e.target.closest('.tma-filter-btn');
                if (btn) {
                    currentFilter = btn.getAttribute('data-tag');
                    document.querySelectorAll('.tma-filter-btn').forEach(function(b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    var mobileSelect = document.getElementById('mobile-filter-select');
                    if (mobileSelect) mobileSelect.value = currentFilter;
                    
                    applySearchAndFilter();
                    scrollToGrid(); 
                }
            });

            filterContainer.addEventListener('change', function(e) {
                if (e.target.id === 'mobile-filter-select') {
                    currentFilter = e.target.value;
                    document.querySelectorAll('.tma-filter-btn').forEach(function(b) { 
                        b.classList.toggle('active', b.getAttribute('data-tag') === currentFilter); 
                    });
                    
                    applySearchAndFilter();
                    scrollToGrid(); 
                }
            });
        }
        
        var searchInput = document.getElementById('video-search');
        if (searchInput) searchInput.addEventListener('keyup', applySearchAndFilter);
        
        var copyBtn = document.getElementById('copy-video-link-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function(e) {
                e.preventDefault();
                var urlToShare = this.getAttribute('data-url');
                var videoTitle = document.getElementById('current-video-title') ? document.getElementById('current-video-title').innerText : document.title;
                var textElement = document.getElementById('copy-btn-text');
                
                if (urlToShare) {
                    textElement.innerHTML = ' Opening...';
                    copyBtn.style.background = '#28a745';
                    
                    setTimeout(function() { 
                        textElement.innerText = ' Share this video'; 
                        copyBtn.style.background = '';
                    }, 2500);

                    if (navigator.share) {
                        navigator.share({
                            title: videoTitle,
                            url: urlToShare
                        }).catch(function(err) {
                            console.log("Share canceled:", err);
                        });
                    } else {
                        navigator.clipboard.writeText(urlToShare).then(function() {
                            textElement.innerText = ' Link Copied!';
                        });
                    }
                }
            });
        }
        
        var script = document.createElement('script');
        script.src = '/feeds/posts/default/-/Video?alt=json-in-script&callback=initWatchLibrary&max-results=50';
        document.head.appendChild(script);
    });
})();
//]]>
</script>
