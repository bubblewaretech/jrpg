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
  var state = { query: "", filter: "All", visible: 24 };
  var filters = ["All", "Console-style", "Action", "Strategy", "Dungeon"];
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
    return games.filter(function (game) {
      var matchesFilter = state.filter === "All" || game.genre.toLowerCase().indexOf(state.filter.toLowerCase()) !== -1;
      var haystack = [game.title, game.studio, game.genre, game.availability, game.released].join(" ").toLowerCase();
      return matchesFilter && (!query || haystack.indexOf(query) !== -1);
    });
  }

  function homeView() {
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
          '<div class="results-line"><span id="results-count"></span><span>Sorted A–Z</span></div>' +
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
  }

  function fact(label, value, url) {
    if (!value) return "";
    var rendered = url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer">' + escapeHtml(value) + ' ↗</a>' : escapeHtml(value);
    return '<div class="fact"><p class="fact-label">' + escapeHtml(label) + '</p><p class="fact-value">' + rendered + '</p></div>';
  }

  function detailView(game) {
    if (!game) { homeView(); return; }
    document.title = game.title + " — Cartridge & Quest";
    var description = game.title + " is a " + game.genre.toLowerCase() + " from " + game.studio + ". The archive records its original availability as " + game.availability + ".";
    document.body.innerHTML = shell(
      '<main class="page detail-page">' +
        '<button class="back-link" type="button" data-home>' + arrowIcon + 'Back to all games</button>' +
        '<article>' +
          '<div class="detail-hero">' +
            '<div class="detail-art"><span class="detail-fallback">' + escapeHtml(game.title.charAt(0)) + '</span><img src="' + escapeHtml(safeImage(game.image)) + '" alt="' + escapeHtml(game.imageAlt) + '"></div>' +
            '<div><p class="eyebrow">' + escapeHtml(game.genre) + '</p><h1 class="detail-title">' + escapeHtml(game.title) + '</h1>' +
              '<p class="detail-deck">' + escapeHtml(description) + '</p>' +
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
        '</article>' + footer() +
      '</main>'
    );
    bindGlobalNavigation();
    bindImageFallbacks(document.body);
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
