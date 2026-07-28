import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
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
import { RequireAuth } from "./components/RequireAuth";
import { Footer } from "./components/Footer";
import { RegionPicker } from "./components/RegionPicker";
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

  return (
    <BrowserRouter>
      <Routes>
        {/* Páginas de autenticação: tela cheia, sem o shell do app. */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* O Engine abre sem login. Início, comunidade e serviços são
            livres para visitantes; as rotas pessoais ficam protegidas por
            RequireAuth, que mostra um convite em vez de barrar na porta. */}
        <Route
          element={
            <AppLayout
              user={user}
              settings={settings}
              onSettingsUpdate={setSettings}
              isTopNav={isTopNav}
              dbLoading={dbLoading}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
              isModalOpen={isModalOpen}
              carToEdit={carToEdit}
              onCloseModal={handleCloseModal}
              onSaveCar={saveCarAction}
              ownershipCar={ownershipCar}
              onCloseOwnership={() => setOwnershipCar(null)}
              onSaveOwnership={saveOwnershipAction}
            />
          }
        >
          <Route path="/" element={<Home />} />
          <Route
            path="/garagem"
            element={
              <RequireAuth user={user}>
                <Garagem
                  cars={cars}
                  onOpenModal={handleOpenModal}
                  onOpenDelete={openDeleteConfirmation}
                  onOpenOwnership={setOwnershipCar}
                  defaultSort={settings.preferences.defaultGarageSort}
                  hideValues={settings.privacy.lockSensitiveValues}
                />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth user={user}>
                <DashboardPage
                  cars={cars}
                  settings={settings}
                  onOpenOwnership={setOwnershipCar}
                />
              </RequireAuth>
            }
          />
          <Route
            path="/community"
            element={<Community cars={cars} settings={settings} user={user} />}
          />
          <Route
            path="/messages"
            element={
              <RequireAuth user={user}>
                <Messages user={user} settings={settings} />
              </RequireAuth>
            }
          />
          <Route
            path="/messages/:conversationId"
            element={
              <RequireAuth user={user}>
                <Messages user={user} settings={settings} />
              </RequireAuth>
            }
          />
          <Route
            path="/services"
            element={<Services settings={settings} user={user} />}
          />
          <Route
            path="/services/approvals"
            element={
              <RequireAuth user={user}>
                <ServiceApprovals user={user} />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth user={user}>
                <Settings
                  user={user}
                  settings={settings}
                  onSettingsUpdate={setSettings}
                />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Shell do app (navegação + área de conteúdo) compartilhado por todas as
 * rotas não-autenticação. Renderiza o <Outlet /> da rota casada. Fica
 * acessível a visitantes sem login — as rotas pessoais se protegem sozinhas
 * via RequireAuth.
 */
function AppLayout({
  user,
  settings,
  onSettingsUpdate,
  isTopNav,
  dbLoading,
  sidebarCollapsed,
  onToggleSidebar,
  isModalOpen,
  carToEdit,
  onCloseModal,
  onSaveCar,
  ownershipCar,
  onCloseOwnership,
  onSaveOwnership,
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex min-h-[100dvh] flex-col bg-[var(--engine-bg)] font-sans text-[var(--engine-text)] transition-colors ${
        isTopNav ? "" : "lg:h-[100dvh] lg:flex-row lg:overflow-hidden"
      }`}
    >
      {/* No mobile a rolagem é a do documento (barra de endereço recolhe,
          pull-to-refresh funciona); o painel com rolagem interna só entra
          no desktop, onde a sidebar precisa ficar fixa. */}
      <MobileNav
        profileSettings={settings.profile}
        settings={settings}
        onSettingsUpdate={onSettingsUpdate}
        user={user}
      />

      {isTopNav ? (
        <TopNav
          settings={settings}
          onSettingsUpdate={onSettingsUpdate}
          user={user}
          profileSettings={settings.profile}
        />
      ) : (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={onToggleSidebar}
          profileSettings={settings.profile}
          privacySettings={settings.privacy}
          user={user}
        />
      )}

      <main
        className={`engine-scroll flex min-h-0 min-w-0 flex-1 flex-col px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-10 lg:py-8 lg:pb-8 ${
          isTopNav ? "" : "lg:h-[100dvh] lg:overflow-y-auto"
        }`}
      >
        {/* No layout sidebar, a Topbar global fica no topo do conteúdo (só
            no desktop — no mobile as mesmas ações vivem no header fixo).
            No layout top-nav, ela já está embutida no TopNav. */}
        {!dbLoading && !isTopNav && (
          <div className="engine-container hidden lg:block">
            <div className="flex w-full items-center justify-end gap-1.5 border-b border-[var(--engine-border)] pb-4">
              <RegionPicker className="mr-1" />
              <Topbar
                settings={settings}
                onSettingsUpdate={onSettingsUpdate}
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
            <Outlet />
          </div>
        )}

        {/* Rodapé global — acompanha o conteúdo no fim da rolagem. */}
        {!dbLoading && <Footer />}
      </main>

      {/* A key remonta o formulário a cada carro: sem isso o modal fica
          montado e carrega marca/modelo/ano/preço do carro anterior. */}
      <ModalNewCar
        key={carToEdit?.id ?? "new"}
        isOpen={isModalOpen}
        onClose={onCloseModal}
        onSave={onSaveCar}
        carToEdit={carToEdit}
      />

      <OwnershipModal
        isOpen={Boolean(ownershipCar)}
        car={ownershipCar}
        settings={settings}
        onClose={onCloseOwnership}
        onSave={onSaveOwnership}
      />
    </div>
  );
}

export default App;
