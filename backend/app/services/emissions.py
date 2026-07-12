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
) -> CarbonTransaction:
    """Create a CarbonTransaction, honouring the live auto-calc setting (Gate 2).

    If Settings.auto_emission_calc is True: look up the EmissionFactor, compute
    co2e_amount = quantity * factor_value server-side (ignoring any client value)
    and flag the row auto_generated=True.
    If False: the client must supply co2e_amount (manual entry); auto_generated
    stays False.
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
    elif payload.get("co2e_amount") is None:
        raise HTTPException(
            status_code=422,
            detail="co2e_amount is required when auto emission calculation is off",
        )

    txn = CarbonTransaction(**payload, auto_generated=auto_calc)
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn
