// Central restaurant configuration. Edit values here only.
export const restaurant = {
  nameAr: "عشماوي",
  nameEn: "Ashmawy",
  slogan: "اسم كبير.. وطعم تقيل",
  facebookUrl: "https://www.facebook.com/profile.php?id=100081991827909",
  // Order phone numbers printed on the official menu.
  phones: ["01105102423", "01151199128"],
  // WhatsApp number in international format (no +). Taken from the menu's
  // order number — confirm it is active on WhatsApp. Set to "" to disable.
  whatsappNumber: "201105102423",
  branches: [
    { label: "فرع المطار", address: "أسوان – شارع المطار – بجوار مطعم المصري" },
    {
      label: "فرع المحطة",
      address: "أسوان – شارع سعد زغلول – المحطة – بجوار كشري الصفوة – يمين سيارة فينوس",
    },
  ],
  // Unknown — fill in when confirmed. null hides the value.
  openingHours: null as string | null,
  // Delivery fee in EGP. null = not configured (shown as "يُحدد عند التأكيد").
  deliveryFee: null as number | null,
  supportsPickup: true,
};
