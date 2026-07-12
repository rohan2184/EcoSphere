from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.env import EmissionFactor, CarbonTransaction
from app.models.core import Settings
from app.schemas.env import CarbonTransactionCreate


def calculate_emission(quantity: float, emission_factor: EmissionFactor) -> float:
    """CO2e = quantity * factor_value (kg CO2e per unit)."""
    return quantity * emission_factor.factor_value


def create_carbon_transaction(
    db: Session,
    data: CarbonTransactionCreate,
    auto_generated: bool = False,
) -> CarbonTransaction:
    """Create a CarbonTransaction.

    If Settings.auto_emission_calc is True, always look up the EmissionFactor
    and (re)compute co2e_amount server-side, ignoring any client-supplied value.
    If False, trust the co2e_amount provided in the request (manual entry).
    """
    settings = db.query(Settings).first()
    auto_calc = bool(settings and settings.auto_emission_calc)

    payload = data.model_dump()

    if auto_calc:
        emission_factor = (
            db.query(EmissionFactor)
            .filter(EmissionFactor.id == data.emission_factor_id)
            .first()
        )
        if not emission_factor:
            raise HTTPException(status_code=404, detail="Emission factor not found")
        payload["co2e_amount"] = calculate_emission(data.quantity, emission_factor)

    txn = CarbonTransaction(**payload, auto_generated=auto_generated)
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn
