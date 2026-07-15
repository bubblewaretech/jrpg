(function () {
  "use strict";

  var sourceRoot = document.body;

  function clean(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function linesFrom(element) {
    var lines = [""];

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        lines[lines.length - 1] += " " + node.nodeValue;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.tagName === "BR") {
        lines.push("");
        return;
      }
      Array.prototype.forEach.call(node.childNodes, walk);
    }

    walk(element);
    return lines.map(clean).filter(Boolean);
  }

  function slugify(title) {
    return clean(title)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function field(lines, label) {
    var prefix = label.toLowerCase() + ":";
    var match = lines.find(function (line) { return line.toLowerCase().indexOf(prefix) === 0; });
    return match ? clean(match.slice(prefix.length)) : "";
  }

  function makeRecord(title, image, details, sourceLink, linkElements) {
    title = clean(title);
    if (!title || !image) return null;

    var released = field(details, "Released");
    var genre = field(details, "Genre");
    var platforms = field(details, "Also Available On") || field(details, "Also Available on");
    var translation = field(details, "Translation Patch");
    var reproduction = field(details, "Reproduction Cart");
    var studio = details.find(function (line) {
      return !/^(Released|Genre|Also Available|Translation Patch|Reproduction Cart):/i.test(line) &&
        !/^(Japan Only|US|EU|Japan|Worldwide)/i.test(line);
    }) || "Unknown studio";
    var availability = details.find(function (line) {
      return /Japan Only|US|EU|Japan|Worldwide/i.test(line) && line !== studio;
    }) || "Region not listed";
    var translationLink = Array.prototype.map.call(linkElements || [], function (link) {
      return { href: link.href, label: clean(link.textContent) };
    }).find(function (link) { return /yes|progress|translation|patch/i.test(link.label); });

    return {
      title: title,
      slug: slugify(title),
      image: image.getAttribute("src"),
      imageAlt: title + " artwork",
      studio: studio,
      availability: availability,
      released: released || "Release date not listed",
      genre: genre || "Role-playing game",
      platforms: platforms,
      translation: translation,
      reproduction: reproduction,
      sourceUrl: sourceLink ? sourceLink.href : "",
      translationUrl: translationLink ? translationLink.href : ""
    };
  }

  function extractGames() {
    var games = [];

    Array.prototype.forEach.call(sourceRoot.querySelectorAll(".gameTitle"), function (titleElement) {
      var card = titleElement.closest(".col-sm-3");
      if (!card) return;
      var image = card.querySelector("img");
      var description = card.querySelector(".gameDescription");
      var sourceLink = image ? image.closest("a") : null;
      var game = makeRecord(
        titleElement.textContent,
        image,
        description ? linesFrom(description) : [],
        sourceLink,
        description ? description.querySelectorAll("a") : []
      );
      if (game) games.push(game);
    });

    Array.prototype.forEach.call(sourceRoot.querySelectorAll("img"), function (image) {
      if (image.closest(".col-sm-3")) return;
      var sourceLink = image.closest("a");
      if (!sourceLink) return;
      var candidate = sourceLink.nextElementSibling;
      while (candidate && candidate.tagName !== "SPAN" && candidate.tagName !== "IMG") {
        candidate = candidate.nextElementSibling;
      }
      if (!candidate || candidate.tagName !== "SPAN") return;
      var lines = linesFrom(candidate);
      var title = lines.shift();
      var game = makeRecord(title, image, lines, sourceLink, candidate.querySelectorAll("a"));
      if (game) games.push(game);
    });

    var seen = {};
    return games.filter(function (game) {
      if (!game.slug || seen[game.slug]) return false;
      seen[game.slug] = true;
      return true;
    });
  }

  var games = extractGames();
  var state = { query: "", filter: "All", sort: "name-asc", visible: 24, randomOrder: {} };
  var activeGameSlug = "";
  var filters = ["All", "Console-style", "Action", "Strategy", "Dungeon"];
  var sortOptions = [
    { value: "name-asc", label: "Name A–Z" },
    { value: "name-desc", label: "Name Z–A" },
    { value: "date-asc", label: "Release: oldest first" },
    { value: "date-desc", label: "Release: newest first" },
    { value: "random", label: "Random order" }
  ];
  var searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>';
  var arrowIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"></path></svg>';

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeImage(src) {
    if (!src) return "";
    return src.indexOf("http://img.photobucket.com") === 0 ? src.replace("http://", "https://") : src;
  }

  function shell(content) {
    return '<div class="site-shell">' +
      '<header class="topbar">' +
        '<button class="brand" type="button" data-home aria-label="Return to the archive">' +
          '<span class="brand-mark">C&Q</span><span>Cartridge &amp; Quest</span>' +
        '</button>' +
        '<span class="topbar-meta">Super Nintendo · 1990–1999</span>' +
      '</header>' + content + '</div>';
  }

  function card(game) {
    var initial = escapeHtml(game.title.charAt(0));
    return '<article class="game-card">' +
      '<a class="card-link" href="?game=' + encodeURIComponent(game.slug) + '" data-game="' + escapeHtml(game.slug) + '">' +
        '<div class="card-art"><span class="card-fallback">' + initial + '</span>' +
          '<img loading="lazy" src="' + escapeHtml(safeImage(game.image)) + '" alt="' + escapeHtml(game.imageAlt) + '">' +
        '</div>' +
        '<div class="card-copy">' +
          '<p class="card-kicker">' + escapeHtml(game.genre) + '</p>' +
          '<h2 class="card-title">' + escapeHtml(game.title) + '</h2>' +
          '<p class="card-studio">' + escapeHtml(game.studio) + ' · ' + escapeHtml(game.released) + '</p>' +
        '</div>' +
      '</a>' +
    '</article>';
  }

  function filteredGames() {
    var query = state.query.toLowerCase();
    var results = games.filter(function (game) {
      var matchesFilter = state.filter === "All" || game.genre.toLowerCase().indexOf(state.filter.toLowerCase()) !== -1;
      var haystack = [game.title, game.studio, game.genre, game.availability, game.released].join(" ").toLowerCase();
      return matchesFilter && (!query || haystack.indexOf(query) !== -1);
    });
    return results.sort(compareGames);
  }

  function releaseTime(game) {
    var matcher = /(\d{1,2})\/(\d{1,2}|\?{1,2})\/(\d{2,4})/g;
    var match;
    while ((match = matcher.exec(game.released))) {
      if (/\?/.test(match[2])) continue;
      var year = Number(match[3]);
      if (year < 100) year += 1900;
      return new Date(year, Number(match[1]) - 1, Number(match[2])).getTime();
    }
    return null;
  }

  function compareGames(a, b) {
    if (state.sort === "random") return (state.randomOrder[a.slug] || 0) - (state.randomOrder[b.slug] || 0);
    if (state.sort === "date-asc" || state.sort === "date-desc") {
      var aDate = releaseTime(a);
      var bDate = releaseTime(b);
      if (aDate === null && bDate !== null) return 1;
      if (bDate === null && aDate !== null) return -1;
      if (aDate !== bDate) return state.sort === "date-asc" ? aDate - bDate : bDate - aDate;
    }
    var direction = state.sort === "name-desc" ? -1 : 1;
    return direction * a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  }

  function shuffleGames() {
    var shuffled = games.slice();
    for (var index = shuffled.length - 1; index > 0; index -= 1) {
      var swapIndex = Math.floor(Math.random() * (index + 1));
      var held = shuffled[index];
      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = held;
    }
    shuffled.forEach(function (game, randomIndex) {
      state.randomOrder[game.slug] = randomIndex;
    });
    state.sort = "random";
    state.visible = 24;
  }

  function homeView() {
    activeGameSlug = "";
    document.title = "Cartridge & Quest — The 16-bit JRPG Archive";
    document.body.innerHTML = shell(
      '<main class="page">' +
        '<section class="hero">' +
          '<div><p class="eyebrow">The 16-bit JRPG archive</p><h1>Small carts.<br><em>Big worlds.</em></h1></div>' +
          '<div class="hero-aside"><p>A field guide to the role-playing games that defined—and quietly expanded—the Super Nintendo era.</p>' +
            '<div class="archive-count"><strong>' + games.length + '</strong><span>games catalogued</span></div>' +
          '</div>' +
        '</section>' +
        '<section aria-label="Game catalog">' +
          '<div class="catalog-tools">' +
            '<label class="search-wrap"><span class="sr-only"></span>' + searchIcon + '<input id="game-search" type="search" placeholder="Search titles, studios, genres…" autocomplete="off" value="' + escapeHtml(state.query) + '"></label>' +
            '<div class="filters" role="group" aria-label="Filter by genre">' + filters.map(function (filter) {
              return '<button class="filter' + (state.filter === filter ? ' active' : '') + '" type="button" data-filter="' + filter + '">' + filter + '</button>';
            }).join("") + '</div>' +
          '</div>' +
          '<div class="results-line"><span id="results-count"></span><div class="sort-tools">' +
            '<label class="sort-select">Sort <select id="game-sort" aria-label="Sort games">' + sortOptions.map(function (option) {
              return '<option value="' + option.value + '"' + (state.sort === option.value ? ' selected' : '') + '>' + option.label + '</option>';
            }).join("") + '</select></label>' +
            '<button class="shuffle-button" id="shuffle-games" type="button" aria-label="Shuffle games">Shuffle ↝</button>' +
          '</div></div>' +
          '<div class="game-grid" id="game-grid"></div>' +
          '<div class="load-more-wrap" id="load-more-wrap"></div>' +
        '</section>' +
        footer() +
      '</main>'
    );
    bindGlobalNavigation();
    bindCatalog();
    updateGrid();
    window.scrollTo(0, 0);
  }

  function footer() {
    return '<footer class="site-footer"><span>Cartridge &amp; Quest · An independent game archive</span>' +
      '<span>Original list credited to BoneSnapDeez via <a href="http://www.racketboy.com/forum/viewtopic.php?f=11&t=42708" target="_blank" rel="noreferrer">Racketboy</a></span></footer>';
  }

  function updateGrid() {
    var results = filteredGames();
    var visible = results.slice(0, state.visible);
    var grid = document.getElementById("game-grid");
    var count = document.getElementById("results-count");
    var more = document.getElementById("load-more-wrap");
    if (!grid) return;

    count.textContent = results.length + (results.length === 1 ? " title" : " titles");
    grid.innerHTML = visible.length ? visible.map(card).join("") : '<div class="empty"><h2>No games found</h2><p>Try another title or a broader genre.</p></div>';
    more.innerHTML = results.length > state.visible ? '<button class="button secondary" type="button" id="load-more">Show more games</button>' : "";
    bindCardLinks();
    bindImageFallbacks(grid);
    var loadMore = document.getElementById("load-more");
    if (loadMore) loadMore.addEventListener("click", function () {
      state.visible += 24;
      updateGrid();
    });
  }

  function bindCatalog() {
    var search = document.getElementById("game-search");
    search.addEventListener("input", function (event) {
      state.query = event.target.value;
      state.visible = 24;
      updateGrid();
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-filter]"), function (button) {
      button.addEventListener("click", function () {
        state.filter = button.getAttribute("data-filter");
        state.visible = 24;
        Array.prototype.forEach.call(document.querySelectorAll("[data-filter]"), function (item) {
          item.classList.toggle("active", item === button);
        });
        updateGrid();
      });
    });
    document.getElementById("game-sort").addEventListener("change", function (event) {
      state.sort = event.target.value;
      if (state.sort === "random") shuffleGames();
      state.visible = 24;
      updateGrid();
    });
    document.getElementById("shuffle-games").addEventListener("click", function () {
      shuffleGames();
      document.getElementById("game-sort").value = "random";
      updateGrid();
    });
  }

  function fact(label, value, url) {
    if (!value) return "";
    var rendered = url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer">' + escapeHtml(value) + ' ↗</a>' : escapeHtml(value);
    return '<div class="fact"><p class="fact-label">' + escapeHtml(label) + '</p><p class="fact-value">' + rendered + '</p></div>';
  }

  function detailView(game) {
    if (!game) { homeView(); return; }
    activeGameSlug = game.slug;
    document.title = game.title + " — Cartridge & Quest";
    var description = game.title + " is a " + game.genre.toLowerCase() + " from " + game.studio + ". The archive records its original availability as " + game.availability + ".";
    document.body.innerHTML = shell(
      '<main class="page detail-page">' +
        '<button class="back-link" type="button" data-home>' + arrowIcon + 'Back to all games</button>' +
        '<article>' +
          '<div class="detail-hero">' +
            '<div class="detail-art"><span class="detail-fallback">' + escapeHtml(game.title.charAt(0)) + '</span><img src="' + escapeHtml(safeImage(game.image)) + '" alt="' + escapeHtml(game.imageAlt) + '"></div>' +
            '<div><p class="eyebrow">' + escapeHtml(game.genre) + '</p><h1 class="detail-title">' + escapeHtml(game.title) + '</h1>' +
              '<p class="detail-deck" id="game-blurb">' + escapeHtml(description) + '</p>' +
              '<p class="detail-source" id="blurb-source" hidden></p>' +
              '<div class="detail-actions"><button class="button" type="button" id="copy-link">Copy game link</button>' +
                (game.sourceUrl ? '<a class="button secondary" href="' + escapeHtml(game.sourceUrl) + '" target="_blank" rel="noreferrer">View image source ↗</a>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<section class="facts" aria-label="Game details">' +
            fact("Studio / publisher", game.studio) +
            fact("Original availability", game.availability) +
            fact("Released", game.released) +
            fact("Genre", game.genre) +
            fact("Also available on", game.platforms) +
            fact("Translation patch", game.translation, game.translationUrl) +
            fact("Reproduction cart", game.reproduction) +
          '</section>' +
          '<section class="media-section" aria-labelledby="media-title">' +
            '<div class="section-heading"><div><p class="eyebrow">A closer look</p><h2 id="media-title">Screenshots &amp; artwork</h2></div>' +
              (game.sourceUrl ? '<a href="' + escapeHtml(game.sourceUrl) + '" target="_blank" rel="noreferrer">Find more images ↗</a>' : '') +
            '</div>' +
            '<div class="media-grid" id="media-grid">' + mediaCard(game.image, game.imageAlt, "Archive image", "") +
              '<div class="media-loading" id="media-loading"><span></span><p>Looking for more game media…</p></div>' +
            '</div>' +
          '</section>' +
        '</article>' + footer() +
      '</main>'
    );
    bindGlobalNavigation();
    bindImageFallbacks(document.body);
    enrichGame(game);
    var copyButton = document.getElementById("copy-link");
    copyButton.addEventListener("click", function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(window.location.href).then(function () {
          copyButton.textContent = "Link copied";
        });
      } else {
        copyButton.textContent = "Copy the URL above";
      }
    });
    window.scrollTo(0, 0);
  }

  function mediaCard(src, alt, label, sourceUrl) {
    var image = '<img loading="lazy" src="' + escapeHtml(safeImage(src)) + '" alt="' + escapeHtml(alt) + '">';
    return '<figure class="media-card">' + (sourceUrl ? '<a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noreferrer">' + image + '</a>' : image) +
      '<figcaption>' + escapeHtml(label) + (sourceUrl ? ' · <a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noreferrer">source ↗</a>' : '') + '</figcaption></figure>';
  }

  function wikiRequest(params) {
    var query = Object.keys(params).map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
    }).join("&");
    return fetch("https://en.wikipedia.org/w/api.php?origin=*&format=json&" + query).then(function (response) {
      if (!response.ok) throw new Error("Wikipedia request failed");
      return response.json();
    });
  }

  function enrichGame(game) {
    wikiRequest({
      action: "query",
      generator: "search",
      gsrsearch: game.title + " video game",
      gsrnamespace: 0,
      gsrlimit: 1,
      prop: "extracts|info|images",
      exintro: 1,
      explaintext: 1,
      exchars: 520,
      inprop: "url",
      imlimit: 30
    }).then(function (data) {
      if (activeGameSlug !== game.slug) throw new Error("Route changed");
      var pages = data.query && data.query.pages ? Object.keys(data.query.pages).map(function (key) { return data.query.pages[key]; }) : [];
      if (!pages.length) throw new Error("No matching article");
      var page = pages[0];
      applyBlurb(page, game.slug);
      var imageTitles = (page.images || []).map(function (image) { return image.title; }).filter(function (title) {
        return relevantWikiImage(title, game);
      }).slice(0, 8);
      if (!imageTitles.length) return [];
      return wikiRequest({
        action: "query",
        prop: "imageinfo",
        titles: imageTitles.join("|"),
        iiprop: "url|mime",
        iiurlwidth: 1200
      }).then(function (imageData) {
        return imageData.query && imageData.query.pages ? Object.keys(imageData.query.pages).map(function (key) { return imageData.query.pages[key]; }) : [];
      });
    }).then(function (imagePages) {
      applyWikiImages(game, imagePages || []);
    }).catch(function () {
      finishMediaLoading(false, game.slug);
    });
  }

  function applyBlurb(page, gameSlug) {
    if (activeGameSlug !== gameSlug) return;
    var blurb = clean(page.extract);
    if (!blurb || /may refer to/i.test(blurb)) return;
    var deck = document.getElementById("game-blurb");
    var source = document.getElementById("blurb-source");
    if (!deck || !source) return;
    deck.textContent = blurb;
    source.hidden = false;
    source.innerHTML = 'From <a href="' + escapeHtml(page.fullurl) + '" target="_blank" rel="noreferrer">Wikipedia ↗</a>';
  }

  function relevantWikiImage(title, game) {
    var lower = title.toLowerCase();
    var words = lower.replace(/[^a-z0-9]+/g, " ");
    if (!/\.(jpe?g|png)$/i.test(lower)) return false;
    if (/logo|icon|symbol|rating|commons|wikidata|flag|padlock|question|semi-protect/.test(lower)) return false;
    if (/\b(cover|box|gameplay|screenshot|screen|title|poster|artwork)\b/.test(words)) return true;
    return game.title.toLowerCase().split(/[^a-z0-9]+/).filter(function (token) {
      return token.length >= 4;
    }).some(function (token) { return lower.indexOf(token) !== -1; });
  }

  function applyWikiImages(game, pages) {
    if (activeGameSlug !== game.slug) return;
    var grid = document.getElementById("media-grid");
    if (!grid) return;
    var seen = {};
    seen[safeImage(game.image)] = true;
    var cards = pages.map(function (page) {
      var info = page.imageinfo && page.imageinfo[0];
      var src = info && (info.thumburl || info.url);
      if (!src || seen[src] || !/^image\//.test(info.mime || "")) return "";
      seen[src] = true;
      return mediaCard(src, game.title + " media from Wikipedia", page.title.replace(/^File:/, ""), info.descriptionurl || page.fullurl || "");
    }).filter(Boolean).slice(0, 3);
    cards.forEach(function (card) { grid.insertAdjacentHTML("beforeend", card); });
    bindImageFallbacks(grid);
    finishMediaLoading(cards.length > 0, game.slug);
  }

  function finishMediaLoading(found, gameSlug) {
    if (activeGameSlug !== gameSlug) return;
    var loading = document.getElementById("media-loading");
    if (!loading) return;
    if (found) {
      loading.remove();
    } else {
      loading.className = "media-empty";
      loading.innerHTML = "<p>No additional Wikimedia media was found for this title.</p>";
    }
  }

  function bindImageFallbacks(root) {
    Array.prototype.forEach.call(root.querySelectorAll("img"), function (image) {
      function hideBroken() { image.hidden = true; }
      image.addEventListener("error", hideBroken);
      if (image.complete && image.naturalWidth === 0) hideBroken();
    });
  }

  function bindCardLinks() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-game]"), function (link) {
      link.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        var slug = link.getAttribute("data-game");
        history.pushState({}, "", "?game=" + encodeURIComponent(slug));
        route();
      });
    });
  }

  function goHome() {
    history.pushState({}, "", window.location.pathname);
    homeView();
  }

  function bindGlobalNavigation() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-home]"), function (button) {
      button.addEventListener("click", goHome);
    });
  }

  function route() {
    var slug = new URLSearchParams(window.location.search).get("game");
    if (!slug) { homeView(); return; }
    detailView(games.find(function (game) { return game.slug === slug; }));
  }

  window.addEventListener("popstate", route);
  document.body.classList.remove("is-loading");
  route();
}());
