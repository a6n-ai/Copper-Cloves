import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { PortalNavigation } from "@/components/PortalNavigation";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, AlertCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Booking {
  id: string;
  class_name: string;
  class_time: string;
  status: string;
  created_at: string;
}

export default function MyBookingsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [canRefund, setCanRefund] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/portal/login"); return; }
    if (status === "authenticated") {
      setIsAuthenticated(true);
      fetchBookings().finally(() => setIsLoading(false));
    }
  }, [status]);

  async function fetchBookings() {
    try {
      const res = await fetch("/api/bookings?status=active");
      if (!res.ok) throw new Error("Failed");
      setBookings(await res.json());
    } catch (error) {
      console.error("Error fetching bookings:", error);
      setBookings([]);
    }
  }

  function handleCancelClick(booking: Booking) {
    setSelectedBooking(booking);
    
    // Calculate if cancellation is within 6 hours
    const classTime = new Date(booking.class_time);
    const now = new Date();
    const hoursDiff = (classTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    setCanRefund(hoursDiff > 6);
    setShowCancelDialog(true);
  }

  async function handleConfirmCancel() {
    if (!selectedBooking) return;
    try {
      setCanceling(true);
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedBooking.id, status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Cancel failed");
      setBookings(prev => prev.filter(b => b.id !== selectedBooking.id));
      setShowCancelDialog(false);
      setSelectedBooking(null);
    } catch (error) {
      console.error("Error canceling booking:", error);
      alert("Failed to cancel booking. Please try again.");
    } finally {
      setCanceling(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function getTimeUntilClass(classTime: string) {
    const now = new Date();
    const classDate = new Date(classTime);
    const hoursDiff = (classDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < 0) return "Past";
    if (hoursDiff < 1) return "Less than 1 hour";
    if (hoursDiff < 24) return `${Math.floor(hoursDiff)} hours`;
    const days = Math.floor(hoursDiff / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sage/30 border-t-sage rounded-full animate-spin mx-auto mb-4" />
          <p className="font-body text-charcoal/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/5">
      <PortalNavigation />

      {/* Header */}
      <div className="relative pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="font-display text-5xl text-charcoal mb-4">My Bookings</h1>
          <p className="font-body text-lg text-charcoal/70 max-w-2xl mx-auto">
            View and manage your upcoming class reservations
          </p>
        </div>
      </div>

      {/* Bookings Grid */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        {bookings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="text-sage" size={40} />
            </div>
            <h3 className="font-display text-2xl text-charcoal mb-3">No Bookings Yet</h3>
            <p className="font-body text-charcoal/60 mb-6">
              You haven't booked any classes. Start your wellness journey today!
            </p>
            <Button 
              onClick={() => router.push("/portal/book")}
              className="bg-sage hover:bg-sage/90 text-white"
            >
              Browse Classes
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const timeUntil = getTimeUntilClass(booking.class_time);
              const isPast = timeUntil === "Past";
              
              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-xl shadow-sm border border-sage/10 p-6 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center justify-between gap-6">
                    {/* Left: Class Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-display text-2xl text-charcoal">
                          {booking.class_name}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-body ${
                          booking.status === "confirmed" 
                            ? "bg-sage/10 text-sage" 
                            : "bg-terracotta/10 text-terracotta"
                        }`}>
                          {booking.status === "confirmed" ? "Confirmed" : "Pending"}
                        </span>
                        {isPast && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-body bg-charcoal/10 text-charcoal/60">
                            Completed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-charcoal/60">
                        <Clock size={16} />
                        <span className="font-body text-sm">{formatTime(booking.class_time)}</span>
                      </div>
                    </div>

                    {/* Middle: Instructor (placeholder) */}
                    <div className="hidden md:block">
                      <p className="font-body text-sm text-charcoal/60">Instructor</p>
                      <p className="font-body text-charcoal">-</p>
                    </div>

                    {/* Middle-Right: Time Until */}
                    {!isPast && (
                      <div className="hidden lg:block">
                        <p className="font-body text-sm text-charcoal/60">Starts in</p>
                        <p className="font-body text-charcoal font-medium">{timeUntil}</p>
                      </div>
                    )}

                    {/* Right: Action Button */}
                    {!isPast && (
                      <div className="flex-shrink-0">
                        <Button
                          onClick={() => handleCancelClick(booking)}
                          size="sm"
                          variant="outline"
                          className="border-terracotta/30 text-terracotta hover:bg-terracotta/5 h-10 px-6"
                        >
                          <X size={16} className="mr-2" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">
              Cancel Booking
            </DialogTitle>
            <DialogDescription className="font-body text-charcoal/70">
              Are you sure you want to cancel your booking for {selectedBooking?.class_name}?
            </DialogDescription>
          </DialogHeader>

          {/* Warning Alert */}
          <Alert className="border-terracotta/30 bg-terracotta/5">
            <AlertCircle className="h-4 w-4 text-terracotta" />
            <AlertDescription className="font-body text-sm text-charcoal ml-2">
              {canRefund ? (
                <>
                  <strong>Cancellation with refund:</strong> You are canceling more than 6 hours before the class. 
                  Your class credit will be refunded to your account.
                </>
              ) : (
                <>
                  <strong>No refund policy:</strong> You are canceling within 6 hours of the class start time. 
                  The class will be canceled, but <strong>your class credit will NOT be reimbursed</strong>.
                </>
              )}
            </AlertDescription>
          </Alert>

          {selectedBooking && (
            <div className="py-4 space-y-2 border-t border-b border-sage/10">
              <div className="flex justify-between">
                <span className="font-body text-sm text-charcoal/60">Class</span>
                <span className="font-body text-charcoal font-medium">{selectedBooking.class_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-body text-sm text-charcoal/60">Date & Time</span>
                <span className="font-body text-charcoal">
                  {formatDate(selectedBooking.class_time)} at {formatTime(selectedBooking.class_time)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-body text-sm text-charcoal/60">Refund Status</span>
                <span className={`font-body font-medium ${canRefund ? "text-sage" : "text-terracotta"}`}>
                  {canRefund ? "Refundable" : "Non-refundable"}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={canceling}
              className="border-sage/20 text-charcoal hover:bg-sage/5"
            >
              Keep Booking
            </Button>
            <Button
              onClick={handleConfirmCancel}
              disabled={canceling}
              className="bg-terracotta hover:bg-terracotta/90 text-white"
            >
              {canceling ? "Canceling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}