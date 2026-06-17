import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import {
  Translate as TranslateIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from "@mui/icons-material";
import { engineDB } from "../services/db";

export function Topbar({ settings, onSettingsUpdate }) {
  const { i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);

  const currentTheme = settings.preferences.theme;

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

    if (engineDB.saveSettings) {
      await engineDB.saveSettings(updatedSettings);
    }
  };

  const handleLangMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleLangMenuClose = () => {
    setAnchorEl(null);
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

    if (engineDB.saveSettings) {
      await engineDB.saveSettings(updatedSettings);
    }

    handleLangMenuClose();
  };

  return (
    <div className="flex w-full items-center justify-end gap-3 border-b border-slate-200/60 pb-4 dark:border-slate-800/50">
      {/* Botão do Tema */}
      <Tooltip title={currentTheme === "dark" ? "Modo Claro" : "Modo Escuro"}>
        <IconButton
          onClick={handleToggleTheme}
          sx={{
            color: currentTheme === "dark" ? "#ffffff" : "#1e293b",
            transition: "all 0.2s ease",
            "&:hover": {
              color: "#ef4444",
              backgroundColor:
                currentTheme === "dark"
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(239,68,68,0.08)",
            },
          }}
        >
          {currentTheme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Tooltip>

      {/* Botão de Idioma */}
      <Tooltip title="Alterar Idioma">
        <IconButton
          onClick={handleLangMenuOpen}
          sx={{
            color: currentTheme === "dark" ? "#ffffff" : "#1e293b",
            transition: "all 0.2s ease",
            "&:hover": {
              color: "#ef4444",
              backgroundColor:
                currentTheme === "dark"
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(239,68,68,0.08)",
            },
          }}
        >
          <TranslateIcon />
        </IconButton>
      </Tooltip>

      {/* Menu Dropdown */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleLangMenuClose}
        disableScrollLock
        slotProps={{
          paper: {
            className:
              "bg-white dark:bg-[#080808] text-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl mt-1 shadow-lg",
          },
        }}
      >
        <MenuItem
          className="font-medium hover:bg-slate-100 dark:hover:bg-slate-900"
          onClick={() => handleChangeLanguage("pt-BR")}
        >
          🇧🇷 Português
        </MenuItem>

        <MenuItem
          className="font-medium hover:bg-slate-100 dark:hover:bg-slate-900"
          onClick={() => handleChangeLanguage("en-US")}
        >
          🇺🇸 English
        </MenuItem>

        <MenuItem
          className="font-medium hover:bg-slate-100 dark:hover:bg-slate-900"
          onClick={() => handleChangeLanguage("es-ES")}
        >
          🇪🇸 Español
        </MenuItem>
      </Menu>
    </div>
  );
}
