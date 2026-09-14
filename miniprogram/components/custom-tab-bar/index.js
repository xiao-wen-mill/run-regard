Component({
  data: {
    tabs: [
      { key: "home", text: "首页", path: "/pages/home/home" },
      { key: "run", text: "跑步", path: "/pages/run/run" },
      { key: "jump", text: "跳绳", path: "/pages/jump/jump" },
      { key: "history", text: "历史", path: "/pages/history/history" },
    ],
    currentKey: "home"
  },

  attached() {
    this.updateCurrentTab();
  },

  methods: {
    updateCurrentTab() {
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        const route = currentPage.route;
        const tabMap = {
          "pages/home/home": "home",
          "pages/run/run": "run",
          "pages/jump/jump": "jump",
          "pages/history/history": "history",
        };
        const key = tabMap[route] || "home";
        this.setData({ currentKey: key });
      }
    },

    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      const key = e.currentTarget.dataset.key;

      if (path) {
        wx.switchTab({ url: path });
      }
    },
  },
});
