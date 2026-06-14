// Google Analytics 4 Tracking Utilities

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Pageview tracking
export const pageview = (url: string) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// Custom event tracking
export const event = ({ action, category, label, value }: {
  action: string;
  category: string;
  label?: string;
  value?: number;
}) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Pre-defined tracking events
export const trackClassView = (className: string) => {
  event({
    action: 'view_class',
    category: 'Class',
    label: className,
  });
};

export const trackBookingClick = (className?: string) => {
  event({
    action: 'booking_click',
    category: 'Conversion',
    label: className || 'general',
  });
};

export const trackPackageView = (packageName: string, price: string) => {
  event({
    action: 'view_package',
    category: 'Package',
    label: `${packageName} - ${price}`,
  });
};

export const trackCafeVisit = () => {
  event({
    action: 'cafe_visit',
    category: 'Cafe',
    label: 'Cafe Page View',
  });
};

export const trackInstructorView = (instructorName: string) => {
  event({
    action: 'view_instructor',
    category: 'Instructor',
    label: instructorName,
  });
};

export const trackMealSubscriptionInterest = () => {
  event({
    action: 'meal_subscription_interest',
    category: 'Conversion',
    label: 'Meal Subscription Page View',
  });
};

export const trackRentalInquiry = () => {
  event({
    action: 'rental_inquiry',
    category: 'Conversion',
    label: 'Rental Form Started',
  });
};