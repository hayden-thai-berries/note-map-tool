/* Tab switching and startup. Loaded last. */
(function(App){
  var S = App.S, $ = App.$;

  function showTab(name){
    var t = name === 'tickets';
    $('mapView').hidden = t; $('board').hidden = !t; $('editBtn').hidden = t;
    $('tabMap').setAttribute('aria-selected', String(!t)); $('tabTix').setAttribute('aria-selected', String(t));
    if (t) App.select(null); else { App.closeForm(); setTimeout(App.drawWires, 50); }
    if (S.model) $('stats').textContent = t ? App.ticketStats() : S.mapStatsText;
    try { history.replaceState(null, '', t ? '#tickets' : location.pathname + location.search); } catch (e) {}
  }
  App.showTab = showTab;
  $('tabMap').addEventListener('click', function(){ showTab('map'); });
  $('tabTix').addEventListener('click', function(){ showTab('tickets'); });

  App.loadMap();
  App.render(S.savedMd);
  App.renderBoard();
  App.loadTickets();
  if (location.hash === '#tickets') showTab('tickets');
})(App);
