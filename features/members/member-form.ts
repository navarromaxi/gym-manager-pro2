export type NewMemberFormState = {
  name: string;
  email: string;
  referralSource: string;
  phone: string;
  cedula: string;
  plan: string;
  planPrice: number;
  planStartDate: string;
  paymentDate: string;
  installments: number;
  paymentAmount: number;
  paymentMethod: string;
  cardBrand: string;
  cardInstallments: number;
  description: string;
  nextInstallmentDue: string;
};

export const PAYMENT_METHODS = [
  "Efectivo",
  "Transferencia",
  "Tarjeta de Débito",
  "Tarjeta de Crédito",
];

export const CARD_BRANDS = [
  "VISA",
  "OCA",
  "MASTER",
  "CABAL",
  "AMEX",
  "TARJETA D",
  "MERCADO PAGO",
];

export const createInitialNewMember = (): NewMemberFormState => {
  const today = new Date().toISOString().split("T")[0];
  return {
    name: "",
    email: "",
    referralSource: "",
    phone: "",
    cedula: "",
    plan: "",
    planPrice: 0,
    planStartDate: today,
    paymentDate: today,
    installments: 1,
    paymentAmount: 0,
    paymentMethod: "Efectivo",
    cardBrand: "",
    cardInstallments: 1,
    description: "",
    nextInstallmentDue: today,
  };
};
