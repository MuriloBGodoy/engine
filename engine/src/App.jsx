import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { auth } from "./services/firebase";
import { engineDB } from "./services/db";
import { useThemeMode } from "./hooks/useThemeMode";
import "./index.css";

import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/TopBar"; // Importando em .jsx
import { ModalNewCar } from "./components/ModalNewCar";
import { DeleteModal } from "./components/DeleteModal";
import { Home } from "./pages/Home";
import { Garagem } from "./pages/Garagem";
import { DashboardPage } from "./pages/DashboardPage";
import { Settings } from "./pages/Settings";
import { Community } from "./pages/Community";

import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

function App() {
  const { i18n, t } = useTranslation();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(true);
  const [cars, setCars] = useState([]);
  const [settings, setSettings] = useState(engineDB.getDefaultSettings());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [carToEdit, setCarToEdit] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [carToDelete, setCarToDelete] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const userId = user?.uid;

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

  const openDeleteConfirmation = (car) => {
    const percentage = car.targetValue
      ? (car.savedValue / car.targetValue) * 100
      : 0;
    const carName = `${car.brand} ${car.model}`;

    setCarToDelete(car);
    setDeleteMessage(
      t("deleteModal.message", {
        carName,
        percentage: percentage.toFixed(0),
      }),
    );
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!carToDelete) return;

    await engineDB.deleteCar(carToDelete.id);
    const updatedCars = await engineDB.getCars();
    setCars(updatedCars);
    setIsDeleteModalOpen(false);
    setCarToDelete(null);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-white dark:bg-[#080808]" />;
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col overflow-hidden bg-gray-50 font-sans text-slate-950 transition-colors lg:flex-row dark:bg-[#080808] dark:text-white">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          profileSettings={settings.profile}
          privacySettings={settings.privacy}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 lg:h-screen lg:p-10">
          {/* Renderiza a Topbar rápida global após carregar o banco */}
          {!dbLoading && (
            <Topbar settings={settings} onSettingsUpdate={setSettings} user={user} />
          )}

          {dbLoading ? (
            <div className="flex h-full items-center justify-center text-gray-500 italic">
              {t("common.loading")}
            </div>
          ) : (
            <div className="mt-4 flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route
                  path="/garagem"
                  element={
                    <Garagem
                      cars={cars}
                      onOpenModal={handleOpenModal}
                      onOpenDelete={openDeleteConfirmation}
                      defaultSort={settings.preferences.defaultGarageSort}
                      hideValues={settings.privacy.lockSensitiveValues}
                    />
                  }
                />
                <Route
                  path="/dashboard"
                  element={<DashboardPage cars={cars} />}
                />
                <Route
                  path="/community"
                  element={
                    <Community cars={cars} settings={settings} user={user} />
                  }
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

        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          message={deleteMessage}
          carName={
            carToDelete ? `${carToDelete.brand} ${carToDelete.model}` : ""
          }
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
