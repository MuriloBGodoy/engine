import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { auth } from "./services/firebase";
import { engineDB } from "./services/db";
import { useThemeMode } from "./hooks/useThemeMode";
import "./index.css";

import { Sidebar } from "./components/Sidebar";
import { TopNav } from "./components/TopNav";
import { MobileNav } from "./components/MobileNav";
import { Topbar } from "./components/TopBar"; // Importando em .jsx
import { ModalNewCar } from "./components/ModalNewCar";
import { OwnershipModal } from "./components/OwnershipModal";
import { useConfirm } from "./components/ConfirmProvider";
import { Home } from "./pages/Home";
import { Garagem } from "./pages/Garagem";
import { DashboardPage } from "./pages/DashboardPage";
import { Settings } from "./pages/Settings";
import { Community } from "./pages/Community";
import { Messages } from "./pages/Messages";
import { ServiceApprovals, Services } from "./pages/Services";

import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ResetPassword } from "./pages/ResetPassword";

function App() {
  const { i18n, t } = useTranslation();
  const confirm = useConfirm();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(true);
  const [cars, setCars] = useState([]);
  const [settings, setSettings] = useState(engineDB.getDefaultSettings());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [carToEdit, setCarToEdit] = useState(null);
  const [ownershipCar, setOwnershipCar] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const userId = user?.uid;
  const isTopNav = settings.preferences.navLayout === "topnav";

  useThemeMode(settings.preferences.theme);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      engineDB.setCurrentUser(currentUser?.uid);
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      engineDB.setCurrentUser(null);
      setCars([]);
      setSettings(engineDB.getDefaultSettings());
      setDbLoading(false);
      return;
    }

    (async () => {
        setDbLoading(true);
      try {
        engineDB.setCurrentUser(userId);
        await engineDB.migrateLegacyData(userId);
        const [savedCars, savedSettings] = await Promise.all([
          engineDB.getCars(),
          engineDB.getSettings(),
        ]);
        setCars(savedCars);
        setSettings(savedSettings);
        // O perfil público só era escrito ao salvar os ajustes — quem nunca
        // entrou lá aparecia como "Usuário Engine" para os outros.
        engineDB
          .syncPublicProfile(savedSettings, userId)
          .catch((error) => console.warn("syncPublicProfile", error));
        if (i18n.language !== savedSettings.preferences.language) {
          i18n.changeLanguage(savedSettings.preferences.language);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setDbLoading(false);
      }
    })();
  }, [i18n, userId]);

  const handleOpenModal = (car = null) => {
    setCarToEdit(car);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCarToEdit(null);
  };

  const saveCarAction = async (carData) => {
    try {
      await engineDB.saveCar(carData);
      const updatedCars = await engineDB.getCars();
      setCars(updatedCars);
      handleCloseModal();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const saveOwnershipAction = async (car, ownershipInputs) => {
    try {
      await engineDB.saveCar({ ...car, ownership: ownershipInputs });
      const updatedCars = await engineDB.getCars();
      setCars(updatedCars);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const openDeleteConfirmation = async (car) => {
    const percentage = car.targetValue
      ? (car.savedValue / car.targetValue) * 100
      : 0;
    const carName = `${car.brand} ${car.model}`;

    const ok = await confirm({
      title: t("deleteModal.title"),
      message: t("deleteModal.message", {
        carName,
        percentage: percentage.toFixed(0),
      }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("deleteModal.keep"),
    });
    if (!ok) return;

    await engineDB.deleteCar(car.id);
    const updatedCars = await engineDB.getCars();
    setCars(updatedCars);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[var(--engine-bg)]" />;
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div
        className={`flex min-h-[100dvh] flex-col bg-[var(--engine-bg)] font-sans text-[var(--engine-text)] transition-colors ${
          isTopNav ? "" : "lg:h-screen lg:flex-row lg:overflow-hidden"
        }`}
      >
        {/* No mobile a rolagem é a do documento (barra de endereço recolhe,
            pull-to-refresh funciona); o painel com rolagem interna só entra
            no desktop, onde a sidebar precisa ficar fixa. */}
        <MobileNav
          profileSettings={settings.profile}
          settings={settings}
          onSettingsUpdate={setSettings}
          user={user}
        />

        {isTopNav ? (
          <TopNav
            settings={settings}
            onSettingsUpdate={setSettings}
            user={user}
            profileSettings={settings.profile}
          />
        ) : (
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
            profileSettings={settings.profile}
            privacySettings={settings.privacy}
          />
        )}

        <main
          className={`engine-scroll flex min-h-0 min-w-0 flex-1 flex-col px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-10 lg:py-8 lg:pb-8 ${
            isTopNav ? "" : "lg:h-screen lg:overflow-y-auto"
          }`}
        >
          {/* No layout sidebar, a Topbar global fica no topo do conteúdo (só
              no desktop — no mobile as mesmas ações vivem no header fixo).
              No layout top-nav, ela já está embutida no TopNav. */}
          {!dbLoading && !isTopNav && (
            <div className="engine-container hidden lg:block">
              <div className="flex w-full items-center justify-end gap-1.5 border-b border-[var(--engine-border)] pb-4">
                <Topbar
                  settings={settings}
                  onSettingsUpdate={setSettings}
                  user={user}
                />
              </div>
            </div>
          )}

          {dbLoading ? (
            <div className="flex h-full items-center justify-center text-[var(--engine-text-subtle)] italic">
              {t("common.loading")}
            </div>
          ) : (
            <div
              className={`engine-container flex flex-1 flex-col ${isTopNav ? "" : "lg:mt-6"}`}
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route
                  path="/garagem"
                  element={
                    <Garagem
                      cars={cars}
                      onOpenModal={handleOpenModal}
                      onOpenDelete={openDeleteConfirmation}
                      onOpenOwnership={setOwnershipCar}
                      defaultSort={settings.preferences.defaultGarageSort}
                      hideValues={settings.privacy.lockSensitiveValues}
                    />
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <DashboardPage
                      cars={cars}
                      settings={settings}
                      onOpenOwnership={setOwnershipCar}
                    />
                  }
                />
                <Route
                  path="/community"
                  element={
                    <Community cars={cars} settings={settings} user={user} />
                  }
                />
                <Route
                  path="/messages"
                  element={<Messages user={user} settings={settings} />}
                />
                <Route
                  path="/messages/:conversationId"
                  element={<Messages user={user} settings={settings} />}
                />
                <Route
                  path="/services"
                  element={<Services settings={settings} user={user} />}
                />
                <Route
                  path="/services/approvals"
                  element={<ServiceApprovals user={user} />}
                />
                <Route
                  path="/settings"
                  element={
                    <Settings
                      user={user}
                      settings={settings}
                      onSettingsUpdate={setSettings}
                    />
                  }
                />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          )}
        </main>

        <ModalNewCar
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={saveCarAction}
          carToEdit={carToEdit}
        />

        <OwnershipModal
          isOpen={Boolean(ownershipCar)}
          car={ownershipCar}
          settings={settings}
          onClose={() => setOwnershipCar(null)}
          onSave={saveOwnershipAction}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
