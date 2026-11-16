/* Shared namespace for the page.
 * These are plain scripts, not ES modules, so index.html still opens from file://.
 * Each file wraps itself in a function and publishes what other files need on App.
 * Load order is set in index.html; files only call each other at event time, not at load. */
var App = {
  /* state shared by every module */
  S: {
    model: null,        /* parsed map: { title, depts, apps, links, warn } */
    nodeEls: {},        /* node key -> element, for sheets and apps only */
    items: {},          /* key -> node or section, anything that can be selected on the map */
    selected: null,
    tdata: { nextId: 1, tickets: [] },
    mapStatsText: '',
    detailNote: '',
    detailWarn: '',
    editingId: null,    /* ticket open in the drawer */
    tview: 'board',
    param: 'work.md',   /* which maps/<name>.md is loaded */
    savedMd: ''
  },
  $: function(id){ return document.getElementById(id); },
  el: function(tag, cls, text){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
};
App.S.savedMd = App.$('md').textContent.replace(/^\n+|\n+$/g, '');
App.S.param = new URLSearchParams(location.search).get('map') || 'work.md';
if (!/^[\w.-]+\.md$/.test(App.S.param)) App.S.param = 'work.md';
