import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useNotification } from './NotificationContext';
import confetti from 'canvas-confetti';

const DonationContext = createContext(null);

export const DonationProvider = ({ children }) => {
  const [donations, setDonations] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [deliveryTasks, setDeliveryTasks] = useState([]);
  const [impactMetrics, setImpactMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useNotification();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dons, reqs, tasks, metrics] = await Promise.all([
        api.getDonations(),
        api.getRequirements(),
        api.getDeliveryTasks(),
        api.getImpactMetrics(),
      ]);
      setDonations(dons);
      setRequirements(reqs);
      setDeliveryTasks(tasks);
      setImpactMetrics(metrics);
    } catch (err) {
      console.error('Failed to load platform data:', err);
      addToast('Error loading platform records: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create new surplus donation
  const createDonation = async (donationData) => {
    try {
      const created = await api.createDonation(donationData);
      setDonations((prev) => [created, ...prev]);
      addToast(`Surplus posted: "${created.foodName}" is now active!`, 'success');
      loadData();
      return created;
    } catch (err) {
      addToast('Failed to create donation: ' + err.message, 'error');
      throw err;
    }
  };

  // Reopen cancelled or remaining donation
  const reopenDonation = async (donationId, notes) => {
    try {
      const updated = await api.reopenDonation(donationId, notes);
      setDonations((prev) => prev.map((d) => (d.id === donationId ? updated : d)));
      addToast('Donation reopened & matched to surrounding community kitchens!', 'success');
      loadData();
      return updated;
    } catch (err) {
      addToast('Failed to reopen donation: ' + err.message, 'error');
      throw err;
    }
  };

  // Recipient submits requirement
  const postRequirement = async (reqData) => {
    try {
      const created = await api.postRequirement(reqData);
      setRequirements((prev) => [created, ...prev]);
      addToast('Requirement logged! Smart matching algorithm initiated.', 'success');
      loadData();
      return created;
    } catch (err) {
      addToast('Failed to post requirement: ' + err.message, 'error');
      throw err;
    }
  };

  // Recipient claims full or partial quantity
  const acceptDonation = async (claimData) => {
    try {
      const res = await api.acceptDonation(claimData);
      setDonations((prev) => prev.map((d) => (d.id === res.donation.id ? res.donation : d)));
      setDeliveryTasks((prev) => [res.task, ...prev]);

      // Confetti burst for successful rescue match!
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#E11D48', '#F59E0B', '#10B981'],
      });

      addToast(
        `Claim registered! ${claimData.quantityAccepted} units allocated. Delivery dispatched.`,
        'success'
      );
      loadData();
      return res;
    } catch (err) {
      addToast('Claim failed: ' + err.message, 'error');
      throw err;
    }
  };

  // Delivery agent updates milestone
  const updateDeliveryMilestone = async (taskId, nextMilestone) => {
    try {
      const updated = await api.updateDeliveryMilestone(taskId, nextMilestone);
      setDeliveryTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      addToast(`Status updated: ${nextMilestone.replace(/_/g, ' ')}`, 'info');
      return updated;
    } catch (err) {
      addToast('Update failed: ' + err.message, 'error');
      throw err;
    }
  };

  // Delivery agent verifies QR and completes handover
  const verifyHandover = async ({ taskId, qrToken, safetyChecklist }) => {
    try {
      const res = await api.verifyHandoverQr({ taskId, qrToken, safetyChecklist });
      setDeliveryTasks((prev) => prev.map((t) => (t.id === taskId ? res.task : t)));

      confetti({
        particleCount: 100,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#10B981', '#34D399', '#FBBF24'],
      });

      addToast('Verified & Handover Complete! Food rescued successfully.', 'success');
      loadData();
      return res;
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  return (
    <DonationContext.Provider
      value={{
        donations,
        requirements,
        deliveryTasks,
        impactMetrics,
        loading,
        refresh: loadData,
        createDonation,
        reopenDonation,
        postRequirement,
        acceptDonation,
        updateDeliveryMilestone,
        verifyHandover,
      }}
    >
      {children}
    </DonationContext.Provider>
  );
};

export const useDonations = () => {
  const context = useContext(DonationContext);
  if (!context) throw new Error('useDonations must be used within a DonationProvider');
  return context;
};
