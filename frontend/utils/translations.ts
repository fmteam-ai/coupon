export interface Translations {
  // Common
  common: {
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    loading: string;
    error: string;
    success: string;
    next: string;
    back: string;
    done: string;
    ok: string;
    yes: string;
    no: string;
    search: string;
    close: string;
    select: string;
    required: string;
  };

  // Navigation
  navigation: {
    home: string;
    aiPicks: string;
    rewards: string;
    map: string;
    business: string;
    social: string;
  };

  // Authentication
  auth: {
    login: string;
    logout: string;
    register: string;
    email: string;
    password: string;
    forgotPassword: string;
    createAccount: string;
    welcomeBack: string;
  };

  // Business Registration
  businessRegistration: {
    title: string;
    registerBusiness: string;
    businessInformation: string;
    businessName: string;
    category: string;
    description: string;
    contactInformation: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    selectCountry: string;
    location: string;
    setCurrentLocation: string;
    selectOnMap: string;
    ownerInformation: string;
    fullName: string;
    businessLogo: string;
    addLogo: string;
    termsText: string;
    selectCategory: string;
    selectLanguage: string;
    preferredLanguage: string;
  };

  // Language Selection
  language: {
    selectLanguage: string;
    changeLanguage: string;
    languageChanged: string;
    languageSettings: string;
    currentLanguage: string;
  };

  // Settings
  settings: {
    settings: string;
    profile: string;
    preferences: string;
    notifications: string;
    privacy: string;
    terms: string;
    about: string;
    support: string;
    version: string;
  };

  // Error Messages
  errors: {
    fillAllFields: string;
    invalidEmail: string;
    passwordTooShort: string;
    networkError: string;
    locationPermissionDenied: string;
    locationError: string;
    registrationFailed: string;
  };

  // Success Messages
  success: {
    registrationSuccess: string;
    profileUpdated: string;
    settingsSaved: string;
    locationSet: string;
  };
}

export const translations: Record<string, Translations> = {
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      edit: 'Edit',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      next: 'Next',
      back: 'Back',
      done: 'Done',
      ok: 'OK',
      yes: 'Yes',
      no: 'No',
      search: 'Search',
      close: 'Close',
      select: 'Select',
      required: 'Required',
    },

    navigation: {
      home: 'Home',
      aiPicks: 'AI Picks',
      rewards: 'Rewards',
      map: 'Map',
      business: 'Business',
      social: 'Social',
    },

    auth: {
      login: 'Login',
      logout: 'Logout',
      register: 'Register',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      createAccount: 'Create Account',
      welcomeBack: 'Welcome Back',
    },

    businessRegistration: {
      title: 'Business Registration',
      registerBusiness: 'Register Business',
      businessInformation: 'Business Information',
      businessName: 'Business Name',
      category: 'Category',
      description: 'Description',
      contactInformation: 'Contact Information',
      phone: 'Phone',
      address: 'Address',
      city: 'City',
      country: 'Country',
      selectCountry: 'Select Country',
      location: 'Location',
      setCurrentLocation: 'Set Current Location',
      selectOnMap: 'Select on Map',
      ownerInformation: 'Owner Information',
      fullName: 'Full Name',
      businessLogo: 'Business Logo',
      addLogo: 'Add Logo',
      termsText: 'By registering your business, you agree to our Terms of Service and Privacy Policy. Your business will be reviewed by our team before approval.',
      selectCategory: 'Select a category',
      selectLanguage: 'Select Language',
      preferredLanguage: 'Preferred Language',
    },

    language: {
      selectLanguage: 'Select Language',
      changeLanguage: 'Change Language',
      languageChanged: 'Language changed successfully',
      languageSettings: 'Language Settings',
      currentLanguage: 'Current Language',
    },

    settings: {
      settings: 'Settings',
      profile: 'Profile',
      preferences: 'Preferences',
      notifications: 'Notifications',
      privacy: 'Privacy',
      terms: 'Terms',
      about: 'About',
      support: 'Support',
      version: 'Version',
    },

    errors: {
      fillAllFields: 'Please fill in all required fields',
      invalidEmail: 'Please enter a valid email address',
      passwordTooShort: 'Password must be at least 6 characters',
      networkError: 'Network error. Please try again.',
      locationPermissionDenied: 'Location permission is required',
      locationError: 'Failed to get your location',
      registrationFailed: 'Registration failed. Please try again.',
    },

    success: {
      registrationSuccess: 'Registration successful!',
      profileUpdated: 'Profile updated successfully',
      settingsSaved: 'Settings saved successfully',
      locationSet: 'Location set successfully',
    },
  },

  ar: {
    common: {
      save: 'حفظ',
      cancel: 'إلغاء',
      confirm: 'تأكيد',
      delete: 'حذف',
      edit: 'تعديل',
      loading: 'جاري التحميل...',
      error: 'خطأ',
      success: 'نجح',
      next: 'التالي',
      back: 'رجوع',
      done: 'تم',
      ok: 'موافق',
      yes: 'نعم',
      no: 'لا',
      search: 'بحث',
      close: 'إغلاق',
      select: 'اختيار',
      required: 'مطلوب',
    },

    navigation: {
      home: 'الرئيسية',
      aiPicks: 'اختيارات الذكي',
      rewards: 'المكافآت',
      map: 'الخريطة',
      business: 'الأعمال',
      social: 'اجتماعي',
    },

    auth: {
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      register: 'التسجيل',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      forgotPassword: 'نسيت كلمة المرور؟',
      createAccount: 'إنشاء حساب',
      welcomeBack: 'مرحباً بعودتك',
    },

    businessRegistration: {
      title: 'تسجيل الأعمال',
      registerBusiness: 'تسجيل العمل',
      businessInformation: 'معلومات العمل',
      businessName: 'اسم العمل',
      category: 'الفئة',
      description: 'الوصف',
      contactInformation: 'معلومات الاتصال',
      phone: 'الهاتف',
      address: 'العنوان',
      city: 'المدينة',
      country: 'البلد',
      selectCountry: 'اختيار البلد',
      location: 'الموقع',
      setCurrentLocation: 'تحديد الموقع الحالي',
      selectOnMap: 'اختيار على الخريطة',
      ownerInformation: 'معلومات المالك',
      fullName: 'الاسم الكامل',
      businessLogo: 'شعار العمل',
      addLogo: 'إضافة شعار',
      termsText: 'بتسجيل عملك، فإنك توافق على شروط الخدمة وسياسة الخصوصية. سيتم مراجعة عملك من قبل فريقنا قبل الموافقة.',
      selectCategory: 'اختيار فئة',
      selectLanguage: 'اختيار اللغة',
      preferredLanguage: 'اللغة المفضلة',
    },

    language: {
      selectLanguage: 'اختيار اللغة',
      changeLanguage: 'تغيير اللغة',
      languageChanged: 'تم تغيير اللغة بنجاح',
      languageSettings: 'إعدادات اللغة',
      currentLanguage: 'اللغة الحالية',
    },

    settings: {
      settings: 'الإعدادات',
      profile: 'الملف الشخصي',
      preferences: 'التفضيلات',
      notifications: 'الإشعارات',
      privacy: 'الخصوصية',
      terms: 'الشروط',
      about: 'حول',
      support: 'الدعم',
      version: 'الإصدار',
    },

    errors: {
      fillAllFields: 'يرجى ملء جميع الحقول المطلوبة',
      invalidEmail: 'يرجى إدخال عنوان بريد إلكتروني صحيح',
      passwordTooShort: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل',
      networkError: 'خطأ في الشبكة. يرجى المحاولة مرة أخرى.',
      locationPermissionDenied: 'مطلوب إذن الموقع',
      locationError: 'فشل في الحصول على موقعك',
      registrationFailed: 'فشل التسجيل. يرجى المحاولة مرة أخرى.',
    },

    success: {
      registrationSuccess: 'تم التسجيل بنجاح!',
      profileUpdated: 'تم تحديث الملف الشخصي بنجاح',
      settingsSaved: 'تم حفظ الإعدادات بنجاح',
      locationSet: 'تم تحديد الموقع بنجاح',
    },
  },
};

export const getTranslation = (languageCode: string = 'en'): Translations => {
  return translations[languageCode] || translations.en;
};