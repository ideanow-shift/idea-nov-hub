# Sheet Selection

The runner selects only fixed effective mappings for Direct 13, FC 7, and approved
headquarters/EC P/L context. B/S, reference/comparison sheets, and unselected P/L
do not produce facts. An unselected P/L sheet is quarantined as `unknown_sheet`;
a missing or duplicate selected mapping fails closed.

Sheet labels are lookup keys only. They never become `store_id`.
