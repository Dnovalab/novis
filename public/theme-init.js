/**
 * React 加载前执行的脚本，防止深色主题启动白屏闪烁。
 * 从 localStorage 读取持久化的主题配置并立即应用到 <html> 根元素。
 */
(function () {
  try {
    var raw = localStorage.getItem("novis_settings");
    if (raw) {
      var settings = JSON.parse(raw);
      if (
        settings.theme === "dark" ||
        (settings.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      ) {
        document.documentElement.classList.add("dark");
      }
    }
  } catch (_) {
    // localStorage 不可用时静默失败
  }
})();
