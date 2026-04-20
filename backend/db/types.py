from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from sqlalchemy.types import UserDefinedType


class VectorType(UserDefinedType):
  cache_ok = True

  def __init__(self, dimensions: int):
    self.dimensions = dimensions

  def get_col_spec(self, **_: Any) -> str:
    return f"vector({self.dimensions})"

  def bind_processor(self, dialect: Any):
    def process(value: Any) -> str | None:
      if value is None:
        return None
      return vector_literal(value, self.dimensions)

    return process


def vector_literal(value: Iterable[float] | str, dimensions: int | None = None) -> str:
  if isinstance(value, str):
    return value

  numbers = [float(item) for item in value]
  if dimensions is not None and len(numbers) != dimensions:
    raise ValueError(
      f"Embedding dimensions mismatch. Expected {dimensions}, received {len(numbers)}."
    )

  return "[" + ",".join(f"{item:.12f}" for item in numbers) + "]"
