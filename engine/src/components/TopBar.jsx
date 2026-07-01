import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Translate as TranslateIcon,
} from "@mui/icons-material";
import { Bell } from "lucide-react";
import { engineDB } from "../services/db";

export function Topbar({ settings, onSettingsUpdate, user }) {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const currentTheme = settings.preferences.theme;
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (!user?.uid) return undefined;
    return engineDB.subscribeNotifications(user.uid, setNotifications);
  }, [user?.uid]);

  const handleToggleTheme = async () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    const updatedSettings = {
      ...settings,
      preferences: {
        ...settings.preferences,
        theme: nextTheme,
      },
    };

    onSettingsUpdate(updatedSettings);
    await engineDB.saveSettings(updatedSettings);
  };

  const handleChangeLanguage = async (lng) => {
    const updatedSettings = {
      ...settings,
      preferences: {
        ...settings.preferences,
        language: lng,
      },
    };

    onSettingsUpdate(updatedSettings);
    i18n.changeLanguage(lng);
    await engineDB.saveSettings(updatedSettings);
    setAnchorEl(null);
  };

  const handleNotificationsOpen = (event) => {
    setNotificationsAnchor(event.currentTarget);
    engineDB.markNotificationsRead(user?.uid).catch((error) => console.error(error));
  };

  return (
    <div className="flex w-full items-center justify-end gap-3 border-b border-slate-200/60 pb-4 dark:border-slate-800/50">
      <Tooltip title={t("notifications.title")}>
        <button
          type="button"
          onClick={handleNotificationsOpen}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-red-500/10 hover:text-red-600 dark:text-white"
        >
          <Bell size={21} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </Tooltip>

      <Tooltip title={currentTheme === "dark" ? "Modo Claro" : "Modo Escuro"}>
        <IconButton
          onClick={handleToggleTheme}
          sx={{
            color: currentTheme === "dark" ? "#ffffff" : "#1e293b",
            transition: "all 0.2s ease",
            "&:hover": {
              color: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.08)",
            },
          }}
        >
          {currentTheme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Alterar idioma">
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            color: currentTheme === "dark" ? "#ffffff" : "#1e293b",
            transition: "all 0.2s ease",
            "&:hover": {
              color: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.08)",
            },
          }}
        >
          <TranslateIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={notificationsAnchor}
        open={Boolean(notificationsAnchor)}
        onClose={() => setNotificationsAnchor(null)}
        disableScrollLock
        slotProps={{
          paper: {
            className:
              "mt-2 w-[min(92vw,420px)] max-h-[70vh] overflow-y-auto bg-white dark:bg-[#080808] text-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg",
          },
        }}
      >
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="text-xs font-black uppercase tracking-widest text-red-600">
            {t("notifications.title")}
          </p>
        </div>
        {notifications.length ? (
          notifications.slice(0, 12).map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() => setNotificationsAnchor(null)}
              className="block whitespace-normal border-b border-slate-100 px-4 py-3 dark:border-slate-900"
            >
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {notification.text}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                {notification.actorUsername || notification.type}
              </p>
            </MenuItem>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm font-bold text-gray-400">
            {t("notifications.empty")}
          </div>
        )}
      </Menu>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        disableScrollLock
        slotProps={{
          paper: {
            className:
              "mt-1 rounded-xl border border-slate-200 bg-white text-slate-950 shadow-lg dark:border-slate-800 dark:bg-[#080808] dark:text-white",
          },
        }}
      >
        <MenuItem onClick={() => handleChangeLanguage("pt-BR")}>
          BR Portugues
        </MenuItem>
        <MenuItem onClick={() => handleChangeLanguage("en-US")}>
          US English
        </MenuItem>
        <MenuItem onClick={() => handleChangeLanguage("es-ES")}>
          ES Espanol
        </MenuItem>
      </Menu>
    </div>
  );
}
