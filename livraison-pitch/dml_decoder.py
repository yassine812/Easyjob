"""Use the local AMD GPU for SadTalker's expensive 2-D decoder."""
from pathlib import Path
import gc,time
import numpy as np
import torch

def replace_decoder(generator,size):
    import onnxruntime as ort
    if 'DmlExecutionProvider' not in ort.get_available_providers():
        raise RuntimeError('DirectML provider not available')
    path=Path(__file__).resolve().parent/'runtime'/f'decoder-{size}.onnx'
    if not path.exists():
        print('Exporting decoder for DirectML',flush=True)
        example=torch.zeros(1,256,size//4,size//4)
        torch.onnx.export(generator.decoder,example,str(path),input_names=['features'],output_names=['rgb'],opset_version=17,dynamo=False)
    options=ort.SessionOptions()
    options.enable_mem_pattern=False
    options.execution_mode=ort.ExecutionMode.ORT_SEQUENTIAL
    options.intra_op_num_threads=2
    print('Loading decoder on the local AMD GPU',flush=True)
    session=ort.InferenceSession(str(path),sess_options=options,providers=['DmlExecutionProvider','CPUExecutionProvider'])
    class Decoder(torch.nn.Module):
        def forward(self,features):
            arr=np.ascontiguousarray(features.detach().cpu().numpy())
            result=session.run(['rgb'],{'features':arr})[0]
            return torch.from_numpy(result)
    generator.decoder=Decoder()
    gc.collect()
    print('DirectML decoder ready',session.get_providers(),flush=True)
